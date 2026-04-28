关于文档系统。docx,xlsx,pdf 转md文档的，我已经单独写成一个服务了。目前只支持这3个文件类型转换


#### 接口说明

**GET /convert?url=** — 通过 URL 转换（最简单）
```bash
curl "http://office2md.lianzhou.work/convert?url=https://example.com/document.docx&token=de6d5f6a-1a81-4407-ba14-d04ebe8d7b8b"
```

**POST /convert** — 上传文件类型转换
```bash
curl -X POST http://office2md.lianzhou.work/convert \
  -F "file=@document.docx" -F "token=de6d5f6a-1a81-4407-ba14-d04ebe8d7b8b"
```

