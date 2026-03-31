<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="skills">
<node TEXT="Agent列表">
<node TEXT="Ai Chat 2列表展示">
<node TEXT="TC-028 Ai Chat 2 Agent列表正常展示">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：已有Ai Chat 2类型Agent">
</node>
<node TEXT="测试步骤：1. 登录 2. 打开Agent列表Ai Chat 2页">
</node>
<node TEXT="预期结果：完整展示Ai Chat 2类型Agent">
</node>
<node TEXT="验证点：展示所有Ai Chat 2类型Agent">
</node>
<node TEXT="验证点：数量与数据库一致">
</node>
</node>
</node>
<node TEXT="Ai Chat 6列表展示">
<node TEXT="TC-027 Ai Chat 6 Agent列表正常展示">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：已有Ai Chat 6类型Agent">
</node>
<node TEXT="测试步骤：1. 登录 2. 打开Agent列表Ai Chat 6页">
</node>
<node TEXT="预期结果：完整展示Ai Chat 6类型Agent">
</node>
<node TEXT="验证点：展示所有Ai Chat 6类型Agent">
</node>
<node TEXT="验证点：列表展示数量正确">
</node>
</node>
</node>
<node TEXT="Ai Chat 6搜索">
<node TEXT="TC-029 Ai Chat 6 Agent列表搜索功能">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：Ai Chat 6 Agent列表有数据">
</node>
<node TEXT="测试步骤：1. 登录 2. 打开Ai Chat 6列表 3. 输入关键词搜索">
</node>
<node TEXT="预期结果：列表只显示符合搜索条件的Ai Chat 6 Agent">
</node>
<node TEXT="验证点：搜索结果准确过滤">
</node>
<node TEXT="验证点：无多余或遗漏">
</node>
</node>
</node>
<node TEXT="列表展示">
<node TEXT="TC-004 Agent列表正常加载与显示">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：数据库中已有Agent数据">
</node>
<node TEXT="测试步骤：1. 登录 2. 进入Agent列表页">
</node>
<node TEXT="预期结果：页面完整展示所有Agent摘要信息">
</node>
<node TEXT="验证点：所有Agent名称正确显示">
</node>
<node TEXT="验证点：Agent数量与数据库一致">
</node>
</node>
</node>
<node TEXT="异常处理">
<node TEXT="TC-008 Agent列表网络超时场景">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户联网，但网络波动或超时">
</node>
<node TEXT="测试步骤：1. 登录 2. 进入Agent列表页">
</node>
<node TEXT="预期结果：页面提示网络超时，请重试">
</node>
<node TEXT="验证点：明确提示网络异常">
</node>
<node TEXT="验证点：功能受限，不能操作">
</node>
</node>
</node>
<node TEXT="搜索">
<node TEXT="TC-005 Agent列表搜索功能正常">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：已有多个Agent，搜索关键词存在">
</node>
<node TEXT="测试步骤：1. 登录 2. 进入Agent列表 3. 在搜索框输入Agent名称关键词">
</node>
<node TEXT="预期结果：列表只显示名称包含关键词的Agent">
</node>
<node TEXT="验证点：搜索结果准确过滤">
</node>
<node TEXT="验证点：无重复、遗漏">
</node>
</node>
<node TEXT="TC-006 Agent列表搜索输入空字符">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：Agent列表有多个Agent">
</node>
<node TEXT="测试步骤：1. 登录 2. 进入Agent列表页 3. 搜索框输入空字符">
</node>
<node TEXT="预期结果：列表展示全部Agent">
</node>
<node TEXT="验证点：为空的输入不会影响展示">
</node>
<node TEXT="验证点：无搜索错误提示">
</node>
</node>
<node TEXT="TC-007 Agent列表搜索无匹配结果时展示">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：Agent列表中无匹配指定字符的Agent">
</node>
<node TEXT="测试步骤：1. 登录 2. 输入不存在的Agent名进行搜索">
</node>
<node TEXT="预期结果：列表显示暂无数据或无匹配Agent提示">
</node>
<node TEXT="验证点：页面显示空结果提示">
</node>
<node TEXT="验证点：无Agent项展示">
</node>
</node>
</node>
</node>
<node TEXT="Agent详情页">
<node TEXT="异常处理">
<node TEXT="TC-013 Agent详情页面无此Agent时提示">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：数据库无该Agent">
</node>
<node TEXT="测试步骤：1. 登录 2. 访问不存在Agent详情页">
</node>
<node TEXT="预期结果：页面提示Agent不存在">
</node>
<node TEXT="验证点：明确报错提示">
</node>
<node TEXT="验证点：页面无内容展示">
</node>
</node>
</node>
<node TEXT="权限校验">
<node TEXT="TC-014 Agent详情页权限不足场景">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户无查看该Agent权限">
</node>
<node TEXT="测试步骤：1. 登录 2. 访问Agent详情页">
</node>
<node TEXT="预期结果：页面提示权限不足，无法展示Agent详情">
</node>
<node TEXT="验证点：页面显示权限不足提示">
</node>
<node TEXT="验证点：无Agent敏感信息展示">
</node>
</node>
</node>
<node TEXT="详情展示">
<node TEXT="TC-012 Agent详情页正常展示">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：Agent列表有数据，用户已登录">
</node>
<node TEXT="测试步骤：1. 点击Agent列表某个Agent进入详情页">
</node>
<node TEXT="预期结果：详情页展示Agent所有属性信息">
</node>
<node TEXT="验证点：Agent名、摘要、Skill等信息正确显示">
</node>
<node TEXT="验证点：信息与列表一致">
</node>
</node>
</node>
</node>
<node TEXT="Skill详情页">
<node TEXT="异常处理">
<node TEXT="TC-016 Skill详情页网络错误场景">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：Skill详情页访问时网络故障">
</node>
<node TEXT="测试步骤：1. 登录 2. 访问Skill详情页">
</node>
<node TEXT="预期结果：页面提示网络错误，内容无法加载">
</node>
<node TEXT="验证点：明确提示网络异常">
</node>
<node TEXT="验证点：无Skill内容展示">
</node>
</node>
</node>
<node TEXT="详情展示">
<node TEXT="TC-015 Skill详情页正常展示">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：Skill已配置，用户已登录">
</node>
<node TEXT="测试步骤：1. 点击某Agent的Skill进入Skill详情页">
</node>
<node TEXT="预期结果：Skill详情页完整展示Skill信息">
</node>
<node TEXT="验证点：Skill名称、描述等完整展示">
</node>
<node TEXT="验证点：展示绑定Agent">
</node>
</node>
</node>
<node TEXT="边界场景">
<node TEXT="TC-017 Skill详情页展示无绑定Agent场景">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：Skill未绑定任何Agent">
</node>
<node TEXT="测试步骤：1. 登录 2. 打开Skill详情页">
</node>
<node TEXT="预期结果：Skill详情页显示无绑定Agent提示">
</node>
<node TEXT="验证点：无Agent信息展示">
</node>
<node TEXT="验证点：页面提示Skill未绑定Agent">
</node>
</node>
</node>
</node>
<node TEXT="创建Agent">
<node TEXT="新建流程">
<node TEXT="TC-009 创建Agent成功流程">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录，拥有可创建权限">
</node>
<node TEXT="测试步骤：1. 点击“新建Agent” 2. 填写必填信息 3. 提交保存">
</node>
<node TEXT="预期结果：Agent成功创建并在列表中显示">
</node>
<node TEXT="验证点：新Agent出现在Agent列表中">
</node>
<node TEXT="验证点：展示新建成功反馈">
</node>
</node>
</node>
<node TEXT="权限校验">
<node TEXT="TC-011 无权限用户无法新建Agent">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：登录用户无创建Agent权限">
</node>
<node TEXT="测试步骤：1. 登录 2. 尝试新建Agent">
</node>
<node TEXT="预期结果：提示权限不足，不允许创建">
</node>
<node TEXT="验证点：页面显示权限不足">
</node>
<node TEXT="验证点：操作不可提交">
</node>
</node>
</node>
<node TEXT="表单校验">
<node TEXT="TC-010 新建Agent必填字段校验">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录，打开创建Agent页面">
</node>
<node TEXT="测试步骤：1. 点击新建Agent 2. 不填写必填项直接提交">
</node>
<node TEXT="预期结果：页面提示填写必填字段，不允许创建">
</node>
<node TEXT="验证点：必填项有红色提示">
</node>
<node TEXT="验证点：无法通过校验提交">
</node>
</node>
</node>
</node>
<node TEXT="历史记录">
<node TEXT="异常处理">
<node TEXT="TC-026 历史记录无数据时展示">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户无任何历史操作记录">
</node>
<node TEXT="测试步骤：1. 登录 2. 打开历史记录页面">
</node>
<node TEXT="预期结果：页面提示暂无历史记录">
</node>
<node TEXT="验证点：空列表显示提示信息">
</node>
<node TEXT="验证点：无记录项展示">
</node>
</node>
</node>
<node TEXT="记录展示">
<node TEXT="TC-025 历史记录页面正常展示所有操作记录">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户有历史操作记录">
</node>
<node TEXT="测试步骤：1. 登录 2. 进入历史记录页面">
</node>
<node TEXT="预期结果：完整展示所有历史操作记录">
</node>
<node TEXT="验证点：操作时间、内容准确显示">
</node>
<node TEXT="验证点：数据与实际操作一致">
</node>
</node>
</node>
</node>
<node TEXT="汇总">
<node TEXT="数据汇总展示">
<node TEXT="TC-030 汇总页面正常展示所有统计数据">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：后台有数据支撑">
</node>
<node TEXT="测试步骤：1. 登录 2. 打开汇总页面">
</node>
<node TEXT="预期结果：页面展示各类统计数据和总计">
</node>
<node TEXT="验证点：统计数据与实际一致">
</node>
<node TEXT="验证点：页面无漏项">
</node>
</node>
</node>
<node TEXT="边界场景">
<node TEXT="TC-031 汇总页面部分数据为空展示">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：部分数据字段为空或缺失">
</node>
<node TEXT="测试步骤：1. 登录 2. 打开汇总页面">
</node>
<node TEXT="预期结果：页面展示空数据友好提示">
</node>
<node TEXT="验证点：空值位置有占位或提示">
</node>
<node TEXT="验证点：页面无崩溃">
</node>
</node>
</node>
</node>
<node TEXT="用户Agent管理">
<node TEXT="Agent分配">
<node TEXT="TC-023 管理员为用户添加Agent成功">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：管理员已登录；Agent可分配">
</node>
<node TEXT="测试步骤：1. 进入用户Agent管理页 2. 选择Agent分配给用户并提交">
</node>
<node TEXT="预期结果：用户Agent列表新增被分配Agent">
</node>
<node TEXT="验证点：用户Agent列表更新">
</node>
<node TEXT="验证点：操作成功反馈">
</node>
</node>
</node>
<node TEXT="边界场景">
<node TEXT="TC-024 为用户分配重复Agent场景">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：该Agent已分配给用户">
</node>
<node TEXT="测试步骤：1. 登录管理员 2. 再次分配同一Agent给用户">
</node>
<node TEXT="预期结果：系统提示Agent已分配，操作无效">
</node>
<node TEXT="验证点：操作收到错误提示">
</node>
<node TEXT="验证点：无重复Agent出现">
</node>
</node>
</node>
</node>
<node TEXT="用户Skill管理">
<node TEXT="Skill分配">
<node TEXT="TC-021 管理员为用户分配Skill成功">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：管理员已登录 ；Skill可分配">
</node>
<node TEXT="测试步骤：1. 进入用户Skill管理页 2. 为用户选择Skill并提交分配">
</node>
<node TEXT="预期结果：用户Skill列表增加新Skill">
</node>
<node TEXT="验证点：用户Skill成功显示">
</node>
<node TEXT="验证点：操作结果有反馈">
</node>
</node>
</node>
<node TEXT="异常处理">
<node TEXT="TC-022 为用户分配Skill失败场景">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：分配Skill过程中服务器异常">
</node>
<node TEXT="测试步骤：1. 管理员登录 2. 分配Skill时服务器报错">
</node>
<node TEXT="预期结果：提示操作失败，Skill未分配">
</node>
<node TEXT="验证点：明确操作失败提示">
</node>
<node TEXT="验证点：用户Skill列表未改变">
</node>
</node>
</node>
</node>
<node TEXT="用户管理">
<node TEXT="异常处理">
<node TEXT="TC-020 用户管理权限不足场景">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户无后台管理权限">
</node>
<node TEXT="测试步骤：1. 登录普通用户账号 2. 访问用户管理">
</node>
<node TEXT="预期结果：页面提示权限不足，无法操作">
</node>
<node TEXT="验证点：显示权限不足提示">
</node>
<node TEXT="验证点：无操作入口展示">
</node>
</node>
</node>
<node TEXT="搜索用户">
<node TEXT="TC-019 用户管理页面搜索功能">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：后台有多个用户">
</node>
<node TEXT="测试步骤：1. 登录后台 2. 输入用户姓名进行搜索">
</node>
<node TEXT="预期结果：只展示符合条件的用户">
</node>
<node TEXT="验证点：搜索结果正确过滤">
</node>
<node TEXT="验证点：无多余或遗漏">
</node>
</node>
</node>
<node TEXT="用户列表展示">
<node TEXT="TC-018 用户管理正常展示所有用户">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：数据库已有用户数据">
</node>
<node TEXT="测试步骤：1. 登录后台管理 2. 进入用户管理页">
</node>
<node TEXT="预期结果：完整展示所有用户列表信息">
</node>
<node TEXT="验证点：用户姓名、账号状态等信息展示">
</node>
<node TEXT="验证点：数据一致">
</node>
</node>
</node>
</node>
<node TEXT="首页">
<node TEXT="登录展示">
<node TEXT="TC-001 未登录用户首页提示登录">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户未登录">
</node>
<node TEXT="测试步骤：1. 进入首页">
</node>
<node TEXT="预期结果：首页展示登录提示及功能受限说明">
</node>
<node TEXT="验证点：显示欢迎语及【立即登录】按钮">
</node>
<node TEXT="验证点：提示登录后可以使用标注、导出等功能">
</node>
</node>
</node>
<node TEXT="登录流程">
<node TEXT="TC-002 登录成功后首页展示可用功能">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已注册并正常登录">
</node>
<node TEXT="测试步骤：1. 登录账号 2. 进入首页">
</node>
<node TEXT="预期结果：首页展示所有可用功能，登录提示消失">
</node>
<node TEXT="验证点：首页无登录提示">
</node>
<node TEXT="验证点：首页显示标注、导出等高级功能入口">
</node>
</node>
</node>
<node TEXT="错误处理">
<node TEXT="TC-003 首页加载时服务器错误展示">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：服务器出现异常">
</node>
<node TEXT="测试步骤：1. 进入首页">
</node>
<node TEXT="预期结果：系统提示加载失败，请稍后重试">
</node>
<node TEXT="验证点：页面无数据展示">
</node>
<node TEXT="验证点：显式显示报错信息">
</node>
</node>
</node>
</node>
</node>
</map>