package model

import (
	"errors"
	"time"

	"gorm.io/gorm"
)

var ErrAdminAccountConflict = errors.New("管理员账户已被其他会话修改")

type AdminAccount struct {
	ID                   uint      `gorm:"column:id;primaryKey"`
	Username             string    `gorm:"column:username"`
	PasswordHash         string    `gorm:"column:password_hash"`
	MustChangePassword   bool      `gorm:"column:must_change_password"`
	ManagedByEnvironment bool      `gorm:"column:managed_by_environment"`
	Revision             uint      `gorm:"column:revision"`
	CreatedAt            time.Time `gorm:"column:created_at"`
	UpdatedAt            time.Time `gorm:"column:updated_at"`
}

func GetAdminAccount() (*AdminAccount, error) {
	if DB == nil {
		return nil, errors.New("数据库尚未初始化")
	}
	var account AdminAccount
	err := DB.Table("admin_accounts").Where("id = 1").First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &account, nil
}

func CreateAdminAccount(account AdminAccount) error {
	if DB == nil {
		return errors.New("数据库尚未初始化")
	}
	return DB.Table("admin_accounts").Create(&account).Error
}

func UpdateAdminAccount(account AdminAccount) error {
	if DB == nil {
		return errors.New("数据库尚未初始化")
	}
	result := DB.Table("admin_accounts").Where("id = 1 AND revision = ?", account.Revision).Updates(map[string]any{
		"username":               account.Username,
		"password_hash":          account.PasswordHash,
		"must_change_password":   account.MustChangePassword,
		"managed_by_environment": account.ManagedByEnvironment,
		"revision":               gorm.Expr("revision + 1"),
		"updated_at":             time.Now().UTC(),
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrAdminAccountConflict
	}
	return nil
}
