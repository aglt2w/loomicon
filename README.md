# LOOMICON

一个轻量的服装图标资源站，提供图标浏览、搜索、预览、下载与复制功能。

## 🌐 网站地址

[https://loomicon.fun/](https://loomicon.fun/)

## 🏗️ 架构说明

网站由两部分组成：

- **前台**（`index.html`）：图标浏览、搜索、分类筛选、放大预览、下载 / 复制 SVG
- **后台**（`admin.html`）：管理员登录后可对图标和分类进行增删改查、批量上传 SVG、数据导入、修改密码

数据存储在 [Supabase](https://supabase.com/)（免费额度即可），图标内容（SVG 源码）直接存在数据库里，不再依赖本地图标文件。

### 权限模型（三档）

| 角色 | 进入方式 | 权限 |
|---|---|---|
| 访客 | 直接打开网站 | 浏览未上锁的分类 |
| 解锁用户 | 点击右上角 🔒 输入解锁密码 | 额外浏览上锁分类（如 LOGO、OMC 表情） |
| 管理员 | 点击右上角盾牌按钮，输入管理密码 | 进入后台，管理所有图标 / 分类 |

前台右上角三个按钮依次为：GitHub 仓库 → 管理员后台 → 解锁密码。

## 🚀 本地开发

```bash
# 1. 复制配置模板，填入你的 Supabase 项目信息
cp js/config.example.js js/config.js

# 2. 起本地服务
python3 -m http.server 8765

# 3. 打开
# http://127.0.0.1:8765/index.html
```

> `js/config.js` 已被 `.gitignore` 排除，密钥不会进 git，请勿提交。

## 🗄️ Supabase 初始化

1. 在 Supabase 新建项目
2. 打开 SQL Editor，运行 [`supabase/init.sql`](supabase/init.sql)（建表 + RLS + RPC + 默认分类）
3. 从 Project Settings → API 获取 Project URL 和 Publishable key
4. 填入 `js/config.js`

默认密码（初始化后请尽快在后台「设置」中修改）：

- 管理员密码 / 解锁密码见 `supabase/init.sql` 内的默认哈希对应说明

## 🔒 安全设计

- 前端只持有 anon key（可公开），所有写操作通过 `admin_action` SECURITY DEFINER RPC，服务端校验密码哈希（SHA-256 + pgcrypto）
- RLS 开启后，anon 角色对表只有只读权限
- 密码不以明文存储

## 📁 目录结构

```
├── index.html          # 前台页面
├── admin.html          # 后台页面
├── css/
│   ├── styles.css      # 前台样式
│   └── admin.css       # 后台样式
├── js/
│   ├── script.js       # 前台逻辑
│   ├── admin.js        # 后台逻辑
│   ├── config.example.js  # 配置模板（复制为 config.js 使用）
│   └── supabase.js        # Supabase 数据访问层
├── supabase/
│   ├── init.sql           # 数据库初始化脚本
│   └── fix-pgcrypto.sql   # search_path 修复（若 init.sql 已含则无需单独运行）
└── assets/             # 站点静态资源（logo / favicon）
```

## 📝 开发说明

本网站（HTML/CSS/JS）由 AI 辅助编写完成。如果遇到问题，可查看提交记录或联系开发者。
