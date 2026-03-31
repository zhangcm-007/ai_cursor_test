<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="[接口测试] 发送验证码">
<node TEXT="发送验证码">
<node TEXT="参数校验">
<node TEXT="TC-003 参数校验-email必填为空">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：接口: POST /api/app/verifyCode/send">
</node>
<node TEXT="测试步骤：请求体: {&quot;email&quot;: &quot;&quot;, &quot;type&quot;: 0}">
</node>
<node TEXT="预期结果：email参数为空，接口应提示必填错误">
</node>
<node TEXT="验证点：- status: {&quot;equals&quot;: 400}">
</node>
</node>
<node TEXT="TC-004 参数校验-email类型错误">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：接口: POST /api/app/verifyCode/send">
</node>
<node TEXT="测试步骤：请求体: {&quot;email&quot;: 123456, &quot;type&quot;: 0}">
</node>
<node TEXT="预期结果：email参数传递为数字类型，接口应提示类型错误">
</node>
<node TEXT="验证点：- status: {&quot;equals&quot;: 400}">
</node>
</node>
<node TEXT="TC-005 参数校验-type类型错误">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：接口: POST /api/app/verifyCode/send">
</node>
<node TEXT="测试步骤：请求体: {&quot;email&quot;: &quot;test@example.com&quot;, &quot;type&quot;: &quot;abc&quot;}">
</node>
<node TEXT="预期结果：type参数传递为字符串，接口应提示类型错误">
</node>
<node TEXT="验证点：- status: {&quot;equals&quot;: 400}">
</node>
</node>
<node TEXT="TC-006 参数校验-email格式不合法">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：接口: POST /api/app/verifyCode/send">
</node>
<node TEXT="测试步骤：请求体: {&quot;email&quot;: &quot;invalid_email_format&quot;, &quot;type&quot;: 0}">
</node>
<node TEXT="预期结果：email参数格式无@符号，接口应提示格式错误">
</node>
<node TEXT="验证点：- status: {&quot;equals&quot;: 400}">
</node>
</node>
</node>
<node TEXT="异常场景">
<node TEXT="TC-007 异常场景-未授权请求">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：接口: POST /api/app/verifyCode/send">
</node>
<node TEXT="测试步骤：请求体: {&quot;email&quot;: &quot;test@example.com&quot;, &quot;type&quot;: 0}">
</node>
<node TEXT="预期结果：未携带授权Token时请求发送验证码接口">
</node>
<node TEXT="验证点：- status: {&quot;equals&quot;: 401}">
</node>
</node>
<node TEXT="TC-008 异常场景-Token过期">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：接口: POST /api/app/verifyCode/send">
</node>
<node TEXT="测试步骤：请求体: {&quot;email&quot;: &quot;test@example.com&quot;, &quot;type&quot;: 0}">
</node>
<node TEXT="预期结果：使用过期的Token请求发送验证码接口">
</node>
<node TEXT="验证点：- status: {&quot;equals&quot;: 401}">
</node>
<node TEXT="验证点：- body_contains: {&quot;equals&quot;: &quot;token过期&quot;}">
</node>
</node>
<node TEXT="TC-009 异常场景-重复提交验证码请求">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：接口: POST /api/app/verifyCode/send">
</node>
<node TEXT="测试步骤：请求体: {&quot;email&quot;: &quot;test@example.com&quot;, &quot;type&quot;: 0}">
</node>
<node TEXT="预期结果：短时间内多次向同一邮箱提交验证码请求">
</node>
<node TEXT="验证点：- status: {&quot;equals&quot;: 429}">
</node>
</node>
</node>
<node TEXT="正常流程">
<node TEXT="TC-001 正常流程-使用有效邮箱发送登录验证码">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：接口: POST /api/app/verifyCode/send">
</node>
<node TEXT="测试步骤：请求体: {&quot;email&quot;: &quot;user@example.com&quot;, &quot;type&quot;: 0}">
</node>
<node TEXT="预期结果：提交一个有效的邮箱地址，请求发送登录验证码，期望成功返回。">
</node>
<node TEXT="验证点：- status: {&quot;equals&quot;: 200}">
</node>
<node TEXT="验证点：- jsonpath_exists: {&quot;equals&quot;: &quot;$.code&quot;}">
</node>
</node>
<node TEXT="TC-002 正常流程-同邮箱重复请求验证码">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：接口: POST /api/app/verifyCode/send">
</node>
<node TEXT="测试步骤：请求体: {&quot;email&quot;: &quot;user2@example.com&quot;, &quot;type&quot;: 0}">
</node>
<node TEXT="预期结果：同一个有效邮箱地址重复请求发送验证码，系统正常响应。">
</node>
<node TEXT="验证点：- status: {&quot;equals&quot;: 200}">
</node>
<node TEXT="验证点：- jsonpath_exists: {&quot;equals&quot;: &quot;$.code&quot;}">
</node>
</node>
</node>
</node>
</node>
</map>