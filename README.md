# 木雷短链助手 Chrome 扩展

基于 [木雷短网址 API](https://www.mliev.com/docs/dwz/api/api-doc) 的 Chrome 扩展，支持在浏览器中管理短链，并**一键将当前标签页网址生成短链**。

## 功能

- **首次使用引导**：未配置时展示欢迎页，引导前往配置 API（服务地址、App ID、App Secret）
- **API 配置页**：填写 Base URL、App ID、App Secret，支持「测试连接」验证
- **当前页生成短链**：在任意网页点击扩展，点击「将当前页面生成短链」即可生成并复制
- **短链列表**：展示最近短链，支持复制、打开

## 安装方式

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本目录 `shortlink-extension`

## 配置说明

1. 在木雷短网址后台创建 **签名认证（signature）** 类型的 Token，获取 **App ID** 与 **App Secret**
2. 点击扩展图标，若未配置会提示「去配置」；或右键扩展图标 → 选项，打开配置页
3. 填写：
   - **服务地址**：您的短网址服务 Base URL，如 `https://dwz.example.com`（不要以 `/` 结尾）
   - **App ID** / **App Secret**：从后台创建 Token 时获得
4. 点击「保存配置」，可点击「测试连接」确认接口可用

## 技术说明

- 认证方式：HMAC-SHA256 签名（参见 [签名认证文档](https://www.mliev.com/docs/dwz/api/signature-auth)）
- 配置保存在浏览器本地 `chrome.storage.local`，不会上传

## 图标

当前使用占位图标。可自行替换 `icons/` 目录下的 `icon16.png`、`icon32.png`、`icon48.png` 为 16×16、32×32、48×48 的 PNG。

## 许可

仅供学习与自用，请遵守木雷短网址服务条款。
