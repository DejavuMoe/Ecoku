package comment

import (
	"crypto/sha256"
	"ecoku-server/model"
	"fmt"
	"net/http"
	"sort"
	"testing"
	"time"

	"gorm.io/gorm"
)

// Run with -run '^$' -bench BenchmarkPublicList -benchtime=200x -count=5.
// Fixtures are fixed; each sample must return the same complete HTTP response.
func BenchmarkPublicList(b *testing.B) {
	for _, count := range []int{100, 1000, 10000} {
		b.Run(fmt.Sprintf("leaves-%d", count), func(b *testing.B) {
			router := setupCommentTest(b)
			seedSiblings(b, nil, count, "synthetic comment")
			benchmarkPublicList(b, router, "&pageSize=100")
		})
	}
	b.Run("wide-200", func(b *testing.B) {
		router := setupCommentTest(b)
		root := seedSiblings(b, nil, 1, "synthetic root")[0]
		seedSiblings(b, &root.ID, 199, "synthetic reply")
		benchmarkPublicList(b, router, "&pageSize=1")
	})
}

func benchmarkPublicList(b *testing.B, router http.Handler, query string) {
	fixedTime := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	if err := model.DB.Model(&model.Comment{}).Where("site_id = ?", "site-a").UpdateColumns(map[string]any{"created_at": fixedTime, "updated_at": fixedTime}).Error; err != nil {
		b.Fatal(err)
	}
	first := listRequest(router, query)
	if first.Code != http.StatusOK {
		b.Fatalf("warmup: %d %s", first.Code, first.Body.String())
	}
	want := sha256.Sum256(first.Body.Bytes())
	if b.N >= 200 {
		b.Logf("response_sha256=%x", want)
	}
	var queries int64
	if err := model.DB.Callback().Query().After("gorm:query").Register("benchmark:queries", func(*gorm.DB) { queries++ }); err != nil {
		b.Fatal(err)
	}
	b.Cleanup(func() { model.DB.Callback().Query().Remove("benchmark:queries") })
	sqlDB, err := model.DB.DB()
	if err != nil {
		b.Fatal(err)
	}
	before := sqlDB.Stats()
	durations := make([]int64, 0, b.N)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		start := time.Now()
		response := listRequest(router, query)
		durations = append(durations, time.Since(start).Nanoseconds())
		if response.Code != http.StatusOK || sha256.Sum256(response.Body.Bytes()) != want {
			b.Fatal("response changed")
		}
	}
	b.StopTimer()
	after := sqlDB.Stats()
	sort.Slice(durations, func(i, j int) bool { return durations[i] < durations[j] })
	for _, percentile := range []int{50, 95, 99} {
		b.ReportMetric(float64(durations[(len(durations)-1)*percentile/100]), fmt.Sprintf("p%d-ns", percentile))
	}
	b.ReportMetric(float64(queries)/float64(b.N), "queries/op")
	b.ReportMetric(float64(after.WaitDuration-before.WaitDuration)/float64(b.N), "wait-ns/op")
	b.ReportMetric(float64(first.Body.Len()), "response-bytes")
}
