param([ValidateSet('EC-19', 'EC-20', 'all')][string]$Issue = 'all')
$ErrorActionPreference = 'Stop'

function Assert-Test([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

# Shadow HTTP and sleeping so every scenario runs without a server or real credentials.
function Invoke-RestMethod {
    param($Method, $Uri, $Headers, $ContentType, $Body, $WebSession)
    $requestUri = [Uri]$Uri
    $path = $requestUri.AbsolutePath
    if ($path -eq '/api/admin/login') {
        $state.LoginCalls++
        if ($state.Scenario -eq 'login rejected') { throw 'fixture unauthorized' }
        if ($null -ne $WebSession) {
            $WebSession.Cookies.Add($requestUri, [System.Net.Cookie]::new('ecoku_admin_session', 'fixture-session', '/'))
        }
        return [pscustomobject]@{ code = 200; data = [pscustomobject]@{
            expires_at = '2099-01-01T00:00:00Z'; expires_in = 3600
            requires_password_change = ($state.Scenario -eq 'setup required')
        } }
    }
    if ($path -like '/api/admin/*') {
        Assert-Test ($null -ne $WebSession) 'administrator request omitted WebSession'
        Assert-Test ($WebSession.Cookies.GetCookies($requestUri)['ecoku_admin_session'].Value -eq 'fixture-session') 'administrator request omitted session cookie'
        Assert-Test (-not $Headers.ContainsKey('Authorization')) 'obsolete bearer header remains'
        $state.AdminCalls++
        if ($Method -eq 'DELETE') {
            $id = [uint32]($path.Split('/')[-1])
            $unchanged = $state.Deleted.Contains($id)
            [void]$state.Deleted.Add($id)
            return [pscustomobject]@{ code = 200; data = @{ unchanged = $unchanged } }
        }
        return [pscustomobject]@{ code = 200; data = @{ data = @($state.Comments.ToArray()) } }
    }
    if ($path -eq '/api/comment/submit') {
        $state.SubmitCalls++
        Assert-Test ($null -eq $WebSession) 'administrator cookie session leaked to public request'
        if ($state.SubmitCalls -eq 6 -or $state.Scenario -in @('persistent rate limit', 'cumulative retry delay')) {
            if ($state.Scenario -in @('rate limit', 'persistent rate limit', 'cumulative retry delay', 'excessive retry delay', 'malformed retry delay', 'server error')) {
                $status = $(if ($state.Scenario -eq 'server error') { 503 } else { 429 })
                $response = [System.Net.Http.HttpResponseMessage]::new([System.Net.HttpStatusCode]$status)
                $delay = switch ($state.Scenario) {
                    'excessive retry delay' { '999999' }
                    'malformed retry delay' { 'invalid' }
                    'cumulative retry delay' { if ($state.SubmitCalls -eq 1) { '70' } else { '60' } }
                    default { '7' }
                }
                [void]$response.Headers.TryAddWithoutValidation('Retry-After', $delay)
                $state.RejectedBody = $Body
                throw [Microsoft.PowerShell.Commands.HttpResponseException]::new('fixture HTTP failure', $response)
            }
            if ($state.Scenario -eq 'network error') { throw 'fixture connection lost' }
        }
        if ($state.Scenario -eq 'rate limit' -and $state.SubmitCalls -eq 7) {
            Assert-Test ($state.Delays.Count -eq 1 -and $state.Delays[0] -eq 7) 'retry did not honor Retry-After'
            Assert-Test ($Body -eq $state.RejectedBody) 'retry changed the rejected comment'
        }
        $inputComment = $Body | ConvertFrom-Json
        $comment = [pscustomobject]@{
            id = [uint32]($state.Comments.Count + 1); parent = [uint32]$inputComment.parent
            content = $inputComment.content; url = $inputComment.url
        }
        $state.Comments.Add($comment)
        return [pscustomobject]@{ code = 201; data = @{ id = $comment.id } }
    }
    if ($path -eq '/api/comment/list') {
        $rows = @($state.Comments.ToArray() | Sort-Object id -Descending:($requestUri.Query -match 'sort=newest') | ForEach-Object {
            $deleted = $state.Deleted.Contains([uint32]$_.id)
            [pscustomobject]@{
                id = $_.id; parent = $_.parent; deleted = $deleted
                content = $(if ($deleted) { '[该评论已删除]' } else { $_.content })
                url = $(if ($deleted) { $null } else { $_.url })
            }
        })
        return [pscustomobject]@{ code = 200; data = @{
            data = $rows; total = @($rows | Where-Object parent -EQ 0).Count
            commentTotal = $rows.Count
        } }
    }
    throw "unexpected fixture request: $Method $Uri"
}

function Start-Sleep { param([double]$Seconds) $state.Delays.Add($Seconds) }

function Test-Scenario([string]$Scenario) {
    $state = @{
        Scenario = $Scenario; LoginCalls = 0; AdminCalls = 0; SubmitCalls = 0
        Comments = [System.Collections.Generic.List[object]]::new()
        Deleted = [System.Collections.Generic.HashSet[uint32]]::new()
        Delays = [System.Collections.Generic.List[double]]::new()
    }
    $failure = $null
    try {
        $result = & "$PSScriptRoot/real-api-smoke.ps1" -BaseUrl 'https://api.example.test' -SiteId 'fixture' -PublicOrigin 'https://blog.example.test' -CommentCount 10 -MaximumDepth 6
    } catch { $failure = $_ }
    if ($Scenario -in @('login rejected', 'setup required')) {
        Assert-Test ($null -ne $failure) "$Scenario did not stop the script"
        Assert-Test ($state.Comments.Count -eq 0) "$Scenario created $($state.Comments.Count) fixtures before authentication"
    } elseif ($Scenario -in @('excessive retry delay', 'malformed retry delay', 'server error', 'network error', 'persistent rate limit', 'cumulative retry delay')) {
        Assert-Test ($null -ne $failure) "$Scenario did not stop the script"
        if ($Scenario -eq 'cumulative retry delay') {
            Assert-Test ($state.SubmitCalls -eq 2 -and $state.Delays.Count -eq 1 -and $state.Delays[0] -eq 70) 'cumulative retry delay exceeded 120 seconds'
        } elseif ($Scenario -eq 'persistent rate limit') {
            Assert-Test ($state.Delays.Count -gt 0 -and $state.Delays.Count -le 3) 'rate limit retries were absent or unbounded'
            Assert-Test ($state.Comments.Count -eq 0) 'rejected requests created fixtures'
        } else {
            Assert-Test ($state.Delays.Count -eq 0 -and $state.SubmitCalls -eq 6) "$Scenario was incorrectly retried"
        }
    } else {
        Assert-Test ($null -eq $failure) "script failed: $failure"
        Assert-Test (($result | ConvertFrom-Json).result -eq 'passed') 'missing passed result'
        Assert-Test ($state.Comments.Count -eq 10) 'fixture count mismatch'
        Assert-Test ($state.AdminCalls -eq 3) 'admin list and deletion calls did not complete'
        if ($Scenario -eq 'rate limit') {
            Assert-Test ($state.SubmitCalls -eq 11) 'rejected submission was not retried exactly once'
        }
    }
}

$previousUsername = $env:ECOKU_SMOKE_ADMIN_USERNAME
$previousPassword = $env:ECOKU_SMOKE_ADMIN_PASSWORD
$failed = 0
try {
    $env:ECOKU_SMOKE_ADMIN_USERNAME = 'fixture-admin'
    $env:ECOKU_SMOKE_ADMIN_PASSWORD = 'fixture-password'
    if ($Issue -in @('EC-19', 'all')) {
        foreach ($scenario in @('cookie login', 'login rejected', 'setup required')) {
            try { Test-Scenario $scenario; Write-Output "PASS EC-19 $scenario" }
            catch { $failed++; Write-Output "FAIL EC-19 ${scenario}: $_" }
        }
    }
    if ($Issue -in @('EC-20', 'all')) {
        foreach ($scenario in @('rate limit', 'persistent rate limit', 'cumulative retry delay', 'excessive retry delay', 'malformed retry delay', 'server error', 'network error')) {
            try { Test-Scenario $scenario; Write-Output "PASS EC-20 $scenario" }
            catch { $failed++; Write-Output "FAIL EC-20 ${scenario}: $_" }
        }
    }
} finally {
    $env:ECOKU_SMOKE_ADMIN_USERNAME = $previousUsername
    $env:ECOKU_SMOKE_ADMIN_PASSWORD = $previousPassword
}
if ($failed -gt 0) { throw "$failed regression scenario(s) failed" }
