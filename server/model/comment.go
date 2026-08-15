package model

import "time"

// Comment 评论数据模型
type Comment struct {
	ID        uint       `gorm:"primaryKey;autoIncrement"`
	SiteID    string     `gorm:"column:site_id;size:100;not null"`
	Mark      string     `gorm:"column:mark;size:512;not null"`
	PageTitle string     `gorm:"column:page_title;size:200;not null"`
	ParentID  *uint      `gorm:"column:parent_id"`
	Username  string     `gorm:"column:username;size:80;not null"`
	Email     *string    `gorm:"column:email;size:254"`
	URL       *string    `gorm:"column:url;size:2048"`
	Content   string     `gorm:"column:content;type:text;not null"`
	IsBlogger bool       `gorm:"column:is_blogger"`
	DeletedAt *time.Time `gorm:"column:deleted_at"`
	CreatedAt time.Time  `gorm:"column:created_at;not null"`
	UpdatedAt time.Time  `gorm:"column:updated_at;not null"`
}

// ParentValue returns the legacy API representation: roots are 0 while the
// database stores roots as NULL.
func (comment Comment) ParentValue() uint {
	if comment.ParentID == nil {
		return 0
	}
	return *comment.ParentID
}
