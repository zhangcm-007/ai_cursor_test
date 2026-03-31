<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="微信红包">
<node TEXT="个人红包">
<node TEXT="发送红包">
<node TEXT="TC-001 发送有效金额的个人红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信，账户余额充足">
</node>
<node TEXT="测试步骤：[&apos;1. 进入微信红包入口&apos;, &apos;2. 选择发普通红包&apos;, &apos;3. 输入金额10元&apos;, &apos;4. 输入祝福语&apos;, &apos;5. 选择支付方式&apos;, &apos;6. 确认支付并验证支付密码&apos;]">
</node>
<node TEXT="预期结果：红包发送成功，页面提示发送成功，聊天界面出现红包信息">
</node>
<node TEXT="验证点：红包状态显示为已发送">
</node>
<node TEXT="验证点：聊天界面有红包消息">
</node>
<node TEXT="验证点：红包详情页金额显示正确">
</node>
</node>
<node TEXT="TC-002 发送红包金额低于下限时提示">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户正常登录，进入发送红包页面">
</node>
<node TEXT="测试步骤：[&apos;1. 输入金额为0.1元&apos;, &apos;2. 点击发送&apos;]">
</node>
<node TEXT="预期结果：系统提示红包金额需≥最小金额（如1元），不可发送">
</node>
<node TEXT="验证点：金额输入框下方有错误提示">
</node>
<node TEXT="验证点：发送按钮为不可用或灰色">
</node>
</node>
<node TEXT="TC-003 发送红包金额大于上限时提示">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户正常登录，进入发送红包页面">
</node>
<node TEXT="测试步骤：[&apos;1. 输入金额为201元&apos;, &apos;2. 点击发送&apos;]">
</node>
<node TEXT="预期结果：系统提示红包金额不能超过最大金额（如200元），红包未发送">
</node>
<node TEXT="验证点：金额输入框下方有错误提示信息">
</node>
<node TEXT="验证点：发送按钮不可用">
</node>
</node>
<node TEXT="TC-004 红包金额为边界最大值200元成功发送">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录，账户余额≥200元">
</node>
<node TEXT="测试步骤：[&apos;1. 输入金额为200元&apos;, &apos;2. 输入祝福语&apos;, &apos;3. 选择支付，输入正确支付密码&apos;]">
</node>
<node TEXT="预期结果：红包成功发出，聊天框出现红包信息">
</node>
<node TEXT="验证点：红包金额记录为200元">
</node>
<node TEXT="验证点：红包状态为已发送">
</node>
</node>
<node TEXT="TC-005 无效字符（如emoji）输入祝福语时提示">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：进入红包发送页面">
</node>
<node TEXT="测试步骤：[&apos;1. 在祝福语输入框输入非法字符如表情或特殊符号&apos;, &apos;2. 点击发送&apos;]">
</node>
<node TEXT="预期结果：系统提示不支持该字符，红包未发送">
</node>
<node TEXT="验证点：页面有明确字符校验提示">
</node>
<node TEXT="验证点：祝福语输入框高亮或警告">
</node>
</node>
<node TEXT="TC-006 余额不足时发送红包失败">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户账户余额小于红包金额">
</node>
<node TEXT="测试步骤：[&apos;1. 输入红包金额大于余额&apos;, &apos;2. 选择支付并输入支付密码&apos;]">
</node>
<node TEXT="预期结果：系统提示余额不足，红包未发送">
</node>
<node TEXT="验证点：弹出余额不足提示框">
</node>
<node TEXT="验证点：红包接口未下单">
</node>
</node>
<node TEXT="TC-007 发送红包时支付密码错误三次，账号受限">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户可正常支付">
</node>
<node TEXT="测试步骤：[&apos;1. 按流程发送红包，连续输入错误支付密码三次&apos;]">
</node>
<node TEXT="预期结果：系统锁定支付操作，红包未发送，并提示账号受限">
</node>
<node TEXT="验证点：支付页面提示账号受限或需验证身份">
</node>
<node TEXT="验证点：红包发送入口受限">
</node>
</node>
<node TEXT="TC-008 网络异常时发送红包流程中断">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：进入可发送红包页面，断网">
</node>
<node TEXT="测试步骤：[&apos;1. 输入金额，点击发送时关闭网络&apos;, &apos;2. 继续操作&apos;, &apos;3. 恢复网络&apos;]">
</node>
<node TEXT="预期结果：发送未成功，系统提示网络异常，恢复后可重试">
</node>
<node TEXT="验证点：有明显网络错误提示">
</node>
<node TEXT="验证点：红包未实际发送">
</node>
</node>
<node TEXT="TC-009 服务器错误导致红包发送失败">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：发红包流程，后端模拟返回500错误">
</node>
<node TEXT="测试步骤：[&apos;1. 输入金额，正常操作发送红包&apos;, &apos;2. 后台模拟服务端500异常&apos;]">
</node>
<node TEXT="预期结果：用户收到服务器错误提示，未扣款未发红包">
</node>
<node TEXT="验证点：后台日志记录服务端异常">
</node>
<node TEXT="验证点：页面友好提示服务器异常">
</node>
</node>
</node>
<node TEXT="红包记录">
<node TEXT="TC-015 查询我的红包收发记录展示正常">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户正常登录，收发过红包">
</node>
<node TEXT="测试步骤：[&apos;1. 进入微信‘我-支付-钱包-红包’&apos;, &apos;2. 查看‘收红包’和‘发红包’列表&apos;]">
</node>
<node TEXT="预期结果：页面正确显示历史红包记录，可查看红包详情">
</node>
<node TEXT="验证点：列表记录准确，金额、时间正确">
</node>
<node TEXT="验证点：可点击进入红包详情页">
</node>
</node>
<node TEXT="TC-016 红包记录无数据时显示空态页面">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：新用户/历史记录已清空">
</node>
<node TEXT="测试步骤：[&apos;1. 进入红包记录页面&apos;]">
</node>
<node TEXT="预期结果：页面展示空记录提示，无异常报错">
</node>
<node TEXT="验证点：空态页面友好展示">
</node>
<node TEXT="验证点：无数据时不可点击红包详情">
</node>
</node>
</node>
<node TEXT="红包退回">
<node TEXT="TC-025 个人红包超过24小时未领取自动退回">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：已发出个人红包但24小时无人领取">
</node>
<node TEXT="测试步骤：[&apos;1. 等待24小时红包未被领取&apos;, &apos;2. 查账户记录及余额&apos;, &apos;3. 查看红包详情&apos;]">
</node>
<node TEXT="预期结果：红包金额自动退回发送者，红包状态显示已退回">
</node>
<node TEXT="验证点：退款到账记录">
</node>
<node TEXT="验证点：红包详情页标记为已退回">
</node>
</node>
</node>
<node TEXT="领取红包">
<node TEXT="TC-010 正常领取未过期未拆开的红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户收到红包，红包有效未拆开">
</node>
<node TEXT="测试步骤：[&apos;1. 在聊天界面点击红包&apos;, &apos;2. 点击‘开’按钮&apos;, &apos;3. 查看领取结果&apos;]">
</node>
<node TEXT="预期结果：页面提示领取成功，余额增加相应金额">
</node>
<node TEXT="验证点：红包状态变为‘已领取’">
</node>
<node TEXT="验证点：金额到账，详情页金额与红包一致">
</node>
</node>
<node TEXT="TC-011 领取已过期红包提示过期">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：红包已过期但未被领取">
</node>
<node TEXT="测试步骤：[&apos;1. 用户点击过期红包&apos;, &apos;2. 进入红包领取页&apos;]">
</node>
<node TEXT="预期结果：页面提示红包已过期，无法领取">
</node>
<node TEXT="验证点：显示‘红包已过期’">
</node>
<node TEXT="验证点：‘开红包’按钮不可操作">
</node>
</node>
<node TEXT="TC-012 重复领取已拆红包提示已领取">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：红包用户已经领取过该红包">
</node>
<node TEXT="测试步骤：[&apos;1. 用户再次点击相同红包&apos;, &apos;2. 进入红包详情页&apos;]">
</node>
<node TEXT="预期结果：显示领取过的状态和金额，不可重复领取">
</node>
<node TEXT="验证点：页面无领取按钮">
</node>
<node TEXT="验证点：明确告知‘您已领取过’">
</node>
</node>
<node TEXT="TC-013 未登录用户点击红包跳转登录">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户未登录微信">
</node>
<node TEXT="测试步骤：[&apos;1. 在收到红包的聊天界面点击红包&apos;, &apos;2. 系统检测未登录状态&apos;]">
</node>
<node TEXT="预期结果：引导用户先登录微信才能领取红包">
</node>
<node TEXT="验证点：页面跳转至登录页">
</node>
<node TEXT="验证点：说明需登录后操作">
</node>
</node>
<node TEXT="TC-014 权限不足无法领取红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户被撤回微信权限">
</node>
<node TEXT="测试步骤：[&apos;1. 点击红包领取时系统检测为未授权&apos;, &apos;2. 页面弹窗提示&apos;]">
</node>
<node TEXT="预期结果：页面提示无权限，无法领取红包">
</node>
<node TEXT="验证点：页面有‘无权限领取’提示或引导">
</node>
<node TEXT="验证点：无领取红包入口">
</node>
</node>
</node>
</node>
<node TEXT="支付方式">
<node TEXT="支付校验">
<node TEXT="TC-026 支付验证身份后才能发红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：微信设置需要人脸/指纹/支付密码验证">
</node>
<node TEXT="测试步骤：[&apos;1. 正常发红包流程&apos;, &apos;2. 支付环节触发人脸/指纹验证&apos;]">
</node>
<node TEXT="预期结果：验证通过后红包发送成功，否则中止">
</node>
<node TEXT="验证点：触发安全验证弹窗">
</node>
<node TEXT="验证点：通过验证才能完成支付">
</node>
</node>
</node>
</node>
<node TEXT="群红包">
<node TEXT="发送群红包">
<node TEXT="TC-017 发送有效金额的普通群红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：群聊用户已登录，余额充足">
</node>
<node TEXT="测试步骤：[&apos;1. 群聊页面进入‘发红包’&apos;, &apos;2. 选择‘普通红包’&apos;, &apos;3. 输入金额&apos;, &apos;4. 输入祝福语&apos;, &apos;5. 选择支付方式并支付&apos;]">
</node>
<node TEXT="预期结果：红包发送成功在群聊显示">
</node>
<node TEXT="验证点：群聊窗口有红包消息">
</node>
<node TEXT="验证点：详情页金额与输入一致">
</node>
</node>
<node TEXT="TC-018 发送手气群红包分配金额不均且金额总和正确">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群成员人数≥2，已登录">
</node>
<node TEXT="测试步骤：[&apos;1. 选择‘手气红包’，输入总金额如50元，人数5人&apos;, &apos;2. 选择支付并完成&apos;, &apos;3. 查看详细分配&apos;]">
</node>
<node TEXT="预期结果：每人实际领取金额不同，金额分配合理，总额为50元">
</node>
<node TEXT="验证点：所有领取人金额之和为50元">
</node>
<node TEXT="验证点：无成员金额为0">
</node>
</node>
<node TEXT="TC-019 群红包人数大于最大上限时提示">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群成员人数&gt;100或超出限制">
</node>
<node TEXT="测试步骤：[&apos;1. 输入群红包人数为101&apos;, &apos;2. 输入金额，点击发送&apos;]">
</node>
<node TEXT="预期结果：页面提示人数不能大于最大群红包人数，不可发送">
</node>
<node TEXT="验证点：发送按钮禁用">
</node>
<node TEXT="验证点：人数输入框有错误提醒">
</node>
</node>
</node>
<node TEXT="群红包记录">
<node TEXT="TC-024 查询群红包收发详情">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：群聊中已参与收发红包">
</node>
<node TEXT="测试步骤：[&apos;1. 进入群红包记录页面&apos;, &apos;2. 查看红包详情&apos;]">
</node>
<node TEXT="预期结果：显示红包分配、金额、领取结果等详情">
</node>
<node TEXT="验证点：群成员昵称、领取金额等信息正确">
</node>
<node TEXT="验证点：总金额与实发金额一致">
</node>
</node>
</node>
<node TEXT="领取群红包">
<node TEXT="TC-020 领取有效未过期群红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户是群成员，红包未拆且未过期">
</node>
<node TEXT="测试步骤：[&apos;1. 在群聊点击红包消息&apos;, &apos;2. 点击‘开’领取&apos;]">
</node>
<node TEXT="预期结果：领取红包，页面显示领取结果及已领取金额">
</node>
<node TEXT="验证点：红包状态为已领取">
</node>
<node TEXT="验证点：领取金额正常显示">
</node>
</node>
<node TEXT="TC-021 非群成员点击群红包无法领取">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：群聊内红包，用户非该群成员">
</node>
<node TEXT="测试步骤：[&apos;1. 非群成员收到群红包链接&apos;, &apos;2. 尝试点击并领取&apos;]">
</node>
<node TEXT="预期结果：系统提示不是群成员无法领取红包">
</node>
<node TEXT="验证点：‘非群成员不可领取’提示">
</node>
<node TEXT="验证点：领取页面无开红包按钮">
</node>
</node>
<node TEXT="TC-022 群红包全部被抢完显示已抢完">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群红包已被其他人领取完">
</node>
<node TEXT="测试步骤：[&apos;1. 点击群聊中红包消息&apos;, &apos;2. 跳转详情页&apos;]">
</node>
<node TEXT="预期结果：显示红包已抢完，无法领取">
</node>
<node TEXT="验证点：‘红包已抢完’提示">
</node>
<node TEXT="验证点：无领取操作">
</node>
</node>
<node TEXT="TC-023 群红包过期无法领取">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：红包已过有效期，未领取完">
</node>
<node TEXT="测试步骤：[&apos;1. 点击红包&apos;, &apos;2. 进入详情页&apos;]">
</node>
<node TEXT="预期结果：显示红包已过期，无法领取">
</node>
<node TEXT="验证点：显示‘已过期’说明">
</node>
<node TEXT="验证点：无领取按钮">
</node>
</node>
</node>
</node>
</node>
</map>