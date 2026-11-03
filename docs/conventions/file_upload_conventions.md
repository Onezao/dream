/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

# 文件上传与存储规范 (File Upload & Storage Conventions)

本文档定义了 Dream 项目中多媒体资料（教师文字介绍、介绍视频、个人照片、ClassIn 二维码、转账凭证截图）的客户端直传、预签名及存储规范。

---

## 1. 客户端预签名直传架构 (Presigned URL)

为减轻业务后端服务器带宽压力，所有图片与视频统一采用 **客户端直传 S3 (Cloudflare R2 / 腾讯云 COS)** 模式：

1. **获取预签名 URL**：前端调用 `/api/dream/v1/files/upload-url`，后端验证操作者身份后生成带时效（300s）的 `PUT` 预签名地址。
2. **客户端直传**：前端通过 `axios/fetch` 将预处理后的图片或视频直接上传到云端对象存储。
3. **保存相对 Key**：上传成功后，前端将对象存储的相对路径（`key`）随表单提交给后端持久化存储。

---

## 2. 媒体预处理与格式约束

### 2.1 教师照片与 ClassIn 二维码图片
- **格式**：推荐 **WebP**，兼容 **PNG / JPEG**。
- **ClassIn 二维码**：必须保持清晰且未被过度压缩，确保手机端长按或扫码可顺利识别。
- **单图体积**：严格控制在 **2MB** 以内。

### 2.2 教师介绍视频
- **格式**：统一采用 **MP4** (H.264 + AAC)，保证全平台浏览器（iOS Safari、Android、桌面端）原生播放兼容性。
- **时长与体积**：介绍视频时长建议 1-3 分钟，体积不超过 **50MB**。

### 2.3 转账单打款凭证截图
- **格式**：PNG / JPEG / WebP。
- **大小**：不超过 5MB。

---

## 3. 存储路径规范 (Storage Key Structure)

- **Key 命名格式**：
  `dream/{biz_type}/{yyyy}/{mm}/{dd}/{uuid12}.{ext}`
  - `biz_type`:
    - `teachers/photos/`：教师照片
    - `teachers/videos/`：教师介绍视频
    - `teachers/classin_qr/`：教师 ClassIn 二维码
    - `transfers/proofs/`：转账打款凭证截图
    - `orders/proofs/`：购课打款凭证截图
  - `uuid12`: 使用 12 位短 ID 作为物理文件名，避免文件名中文或特殊字符导致解析异常。

---

## 4. 数据库存储与 URL 拼接规约

- **数据库只存 Key**：数据库表中（如 `teacher_profiles.classin_qr_url`, `transfer_orders.proof_key`）**严禁存储带域名的绝对 URL**，必须只存储相对 Key。
- **动态拼接 CDN 域名**：后端向前端输出 API 响应或前端渲染时，根据当前环境的 CDN 域名动态拼装完整 Public URL。
