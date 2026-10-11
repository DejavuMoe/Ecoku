param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl,

    [Parameter(Mandatory = $true)]
    [string]$SiteId,

    [Parameter(Mandatory = $true)]
    [string]$PublicOrigin,

    [string]$PageKey = "/posts/the-comment-system-of-static-websites/",

    [string]$PageTitle = "聊聊静态网站的评论系统",

    [ValidateRange(1, 6)]
    [int]$MaximumDepth = 6,

    [ValidateRange(10, 90)]
    [int]$CommentCount = 52
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
Import-Module Microsoft.PowerShell.Utility

if ([string]::IsNullOrWhiteSpace($env:ECOKU_SMOKE_ADMIN_USERNAME) -or
    [string]::IsNullOrWhiteSpace($env:ECOKU_SMOKE_ADMIN_PASSWORD)) {
    throw "ECOKU_SMOKE_ADMIN_USERNAME and ECOKU_SMOKE_ADMIN_PASSWORD are required"
}

$base = $BaseUrl.TrimEnd("/")
$runId = [Guid]::NewGuid().ToString("N").Substring(0, 12)
$privateEmail = "smoke-$runId@example.test"
$publicHeaders = @{ Origin = $PublicOrigin }
$adminHeaders = @{ Origin = $base }

function Invoke-Json {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("GET", "POST", "DELETE")]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [hashtable]$Headers = @{},

        [object]$Body,

        [Microsoft.PowerShell.Commands.WebRequestSession]$WebSession
    )

    $parameters = @{
        Method      = $Method
        Uri         = $Uri
        Headers     = $Headers
        ContentType = "application/json"
    }
    if ($PSBoundParameters.ContainsKey("Body")) {
        $parameters.Body = $Body | ConvertTo-Json -Depth 8 -Compress
    }
    if ($null -ne $WebSession) { $parameters.WebSession = $WebSession }
    Invoke-RestMethod @parameters
}

function Assert-True {
    param(
        [Parameter(Mandatory = $true)]
        [bool]$Condition,

        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Submit-Comment {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content,

        [uint32]$Parent = 0
    )

    $body = @{
        siteId    = $SiteId
        mark      = $PageKey
        pageTitle = $PageTitle
        content   = $Content
        username  = "Ecoku 集成测试"
        email     = $privateEmail
        url       = "https://example.test/ecoku-smoke"
        parent    = $Parent
    }
    $waited = 0
    for ($attempt = 0; ; $attempt += 1) {
        try {
            $response = Invoke-Json -Method POST -Uri "$base/api/comment/submit" -Headers $publicHeaders -Body $body
            break
        } catch {
            # Only an explicit rejection can be retried without duplicating a comment.
            $httpResponse = $_.Exception.Response
            if ($null -eq $httpResponse -or [int]$httpResponse.StatusCode -ne 429 -or $attempt -ge 3) { throw }
            $retryAfter = @($httpResponse.Headers.GetValues('Retry-After'))[0]
            $delay = 0
            if (-not [int]::TryParse($retryAfter, [ref]$delay) -or $delay -lt 0 -or $delay -gt (120 - $waited)) { throw }
            Start-Sleep -Seconds $delay
            $waited += $delay
        }
    }
    Assert-True -Condition ($response.code -eq 201 -and [uint32]$response.data.id -gt 0) -Message "comment submission failed"
    [uint32]$response.data.id
}

$adminSession = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
$login = Invoke-Json -Method POST -Uri "$base/api/admin/login" -Headers $adminHeaders -WebSession $adminSession -Body @{
    username = $env:ECOKU_SMOKE_ADMIN_USERNAME
    password = $env:ECOKU_SMOKE_ADMIN_PASSWORD
}
Assert-True -Condition ($login.code -eq 200 -and [int64]$login.data.expires_in -gt 0) -Message "admin login failed"
Assert-True -Condition (-not [bool]$login.data.requires_password_change) -Message "complete administrator password setup before running the smoke test"

$created = [System.Collections.Generic.List[uint32]]::new()
$chain = [System.Collections.Generic.List[uint32]]::new()
$parent = [uint32]0

for ($level = 1; $level -le $MaximumDepth; $level += 1) {
    $id = Submit-Comment -Content "真实 API 第 $level 级评论（运行 $runId）" -Parent $parent
    $created.Add($id)
    $chain.Add($id)
    $parent = $id
}
for ($index = 1; $index -le ($CommentCount - $MaximumDepth); $index += 1) {
    $created.Add((Submit-Comment -Content "真实 API 根评论 $index（运行 $runId）"))
}
Assert-True -Condition ($created.Count -eq $CommentCount) -Message "fixture count mismatch"

$encodedSite = [Uri]::EscapeDataString($SiteId)
$encodedKey = [Uri]::EscapeDataString($PageKey)
$published = Invoke-Json -Method GET -Uri "$base/api/admin/sites/$encodedSite/comments?status=published&page=1&pageSize=100" -Headers $adminHeaders -WebSession $adminSession
$publishedIds = @($published.data.data | ForEach-Object { [uint32]$_.id })
Assert-True -Condition (@($created | Where-Object { $_ -notin $publishedIds }).Count -eq 0) -Message "published list omitted a created comment"

$newest = Invoke-Json -Method GET -Uri "$base/api/comment/list?siteId=$encodedSite&key=$encodedKey&page=1&pageSize=100&sort=newest" -Headers $publicHeaders
$oldest = Invoke-Json -Method GET -Uri "$base/api/comment/list?siteId=$encodedSite&key=$encodedKey&page=1&pageSize=100&sort=oldest" -Headers $publicHeaders
$publicComments = @($newest.data.data)
Assert-True -Condition ([int]$newest.data.commentTotal -eq $CommentCount) -Message "public commentTotal mismatch"
Assert-True -Condition ($publicComments.Count -eq $CommentCount) -Message "public response omitted descendants"

$byId = @{}
foreach ($comment in $publicComments) { $byId[[uint32]$comment.id] = $comment }
$cursor = [uint32]$chain[$chain.Count - 1]
$observedDepth = 0
$seen = [System.Collections.Generic.HashSet[uint32]]::new()
while ($cursor -ne 0) {
    Assert-True -Condition ($byId.ContainsKey($cursor)) -Message "deep thread comment missing"
    Assert-True -Condition ($seen.Add($cursor)) -Message "parent cycle detected"
    $observedDepth += 1
    $cursor = [uint32]$byId[$cursor].parent
}
Assert-True -Condition ($observedDepth -eq $MaximumDepth) -Message "deep thread depth mismatch"

$forbiddenNames = @("email", "status", "ip", "ua", "location", "user", "user_id", "token", "management_key")
foreach ($comment in $publicComments) {
    $names = @($comment.PSObject.Properties.Name | ForEach-Object { $_.ToLowerInvariant() })
    Assert-True -Condition (@($names | Where-Object { $_ -in $forbiddenNames }).Count -eq 0) -Message "public DTO exposed a private field"
}

$newestRoots = @($newest.data.data | Where-Object { [uint32]$_.parent -eq 0 } | ForEach-Object { [uint32]$_.id })
$oldestRoots = @($oldest.data.data | Where-Object { [uint32]$_.parent -eq 0 } | ForEach-Object { [uint32]$_.id })
Assert-True -Condition ($newestRoots.Count -gt 1 -and $oldestRoots.Count -eq $newestRoots.Count) -Message "root sort fixture incomplete"
Assert-True -Condition ($newestRoots[0] -eq $oldestRoots[$oldestRoots.Count - 1]) -Message "root ordering did not reverse"

$leaf = [uint32]$created[$created.Count - 1]
$deleted = Invoke-Json -Method DELETE -Uri "$base/api/admin/sites/$encodedSite/comments/$leaf" -Headers $adminHeaders -WebSession $adminSession
$deletedAgain = Invoke-Json -Method DELETE -Uri "$base/api/admin/sites/$encodedSite/comments/$leaf" -Headers $adminHeaders -WebSession $adminSession
Assert-True -Condition ($deleted.code -eq 200 -and -not [bool]$deleted.data.unchanged) -Message "tombstone deletion failed"
Assert-True -Condition ($deletedAgain.code -eq 200 -and [bool]$deletedAgain.data.unchanged) -Message "repeated tombstone deletion was not idempotent"

$afterDelete = Invoke-Json -Method GET -Uri "$base/api/comment/list?siteId=$encodedSite&key=$encodedKey&page=1&pageSize=100&sort=newest" -Headers $publicHeaders
$tombstone = @($afterDelete.data.data | Where-Object { [uint32]$_.id -eq $leaf })
Assert-True -Condition ($tombstone.Count -eq 1 -and [bool]$tombstone[0].deleted) -Message "public tombstone missing"
Assert-True -Condition ($tombstone[0].content -eq "[该评论已删除]" -and $null -eq $tombstone[0].url) -Message "tombstone exposed deleted data"

[pscustomobject]@{
    result                  = "passed"
    published_comment_count = $CommentCount
    root_thread_count       = [int]$newest.data.total
    maximum_depth           = $observedDepth
    tombstone_idempotent    = $true
    public_dto_private      = $false
    newest_oldest_sort      = $true
} | ConvertTo-Json -Compress
