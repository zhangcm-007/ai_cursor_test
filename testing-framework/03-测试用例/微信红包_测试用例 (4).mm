<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="微信红包">
<node TEXT="红包发送">
<node TEXT="TC-001 普通红包发送成功流程">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信，账号余额充足。">
</node>
<node TEXT="测试步骤：1. 进入聊天界面。2. 点击“+”选择“红包”。3. 选择“普通红包”。4. 输入金额和祝福语。5. 点击“塞钱进红包”。6. 输入支付密码完成支付。">
</node>
<node TEXT="预期结果：红包发送成功，聊天窗口展示红包消息。">
</node>
<node TEXT="验证点：红包消息在聊天窗正常显示">
</node>
<node TEXT="验证点：红包金额与输入一致">
</node>
<node TEXT="验证点：支付成功后扣款金额正确">
</node>
</node>
<node TEXT="TC-002 拼手气红包发送成功流程">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户在微信群聊，已登录微信，余额充足。">
</node>
<node TEXT="测试步骤：1. 进入群聊页面。2. 点击“+”选择“红包”。3. 选择“拼手气红包”。4. 输入总金额与份数、祝福语。5. 确认无错误后点击“塞钱进红包”。6. 输入支付密码完成支付。">
</node>
<node TEXT="预期结果：红包发送成功，群聊中展示拼手气红包消息。">
</node>
<node TEXT="验证点：拼手气红包消息显示在群聊">
</node>
<node TEXT="验证点：红包金额、份数正确">
</node>
<node TEXT="验证点：支付金额扣除无误">
</node>
</node>
<node TEXT="TC-003 红包金额超限提示">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录，准备发送红包。">
</node>
<node TEXT="测试步骤：1. 进入发送红包页面。2. 输入单个红包金额大于200元（最大限额）。3. 尝试发送红包。">
</node>
<node TEXT="预期结果：系统提示红包金额超出上限，无法发送。">
</node>
<node TEXT="验证点：弹窗提示红包金额超限">
</node>
<node TEXT="验证点：红包发送按钮不可用">
</node>
</node>
<node TEXT="TC-004 红包份数超限提示">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户在群聊，已登录，余额足够。">
</node>
<node TEXT="测试步骤：1. 进入拼手气红包页面。2. 输入红包份数超过100份。3. 尝试发送红包。">
</node>
<node TEXT="预期结果：系统提示红包份数超限，无法发送。">
</node>
<node TEXT="验证点：弹窗提示红包份数超限">
</node>
<node TEXT="验证点：无法发送红包">
</node>
</node>
<node TEXT="TC-005 余额不足发送红包失败">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录，账户余额小于红包金额。">
</node>
<node TEXT="测试步骤：1. 打开红包发送界面。2. 输入大于余额的红包金额。3. 点击塞钱进红包。4. 输入支付密码。">
</node>
<node TEXT="预期结果：系统提示余额不足，红包发送失败。">
</node>
<node TEXT="验证点：余额不足提示弹出">
</node>
<node TEXT="验证点：红包未发送">
</node>
<node TEXT="验证点：未扣除金额">
</node>
</node>
<node TEXT="TC-006 输入非法金额发送红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录。">
</node>
<node TEXT="测试步骤：1. 进入红包发送页面。2. 输入0元或含字母、特殊字符的金额。3. 尝试发送红包。">
</node>
<node TEXT="预期结果：系统限制非法金额输入，禁止发送红包。">
</node>
<node TEXT="验证点：发送按钮置灰/不可点击">
</node>
<node TEXT="验证点：输入框校验弹窗显示">
</node>
</node>
<node TEXT="TC-016 祝福语为空时发送红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已进入红包发送界面。">
</node>
<node TEXT="测试步骤：1. 留空祝福语。2. 输入合法金额。3. 发送红包。">
</node>
<node TEXT="预期结果：红包可正常发送，系统默认祝福语。">
</node>
<node TEXT="验证点：红包发送成功">
</node>
<node TEXT="验证点：发出祝福语为默认值">
</node>
</node>
<node TEXT="TC-017 发送红包时取消支付流程">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：已进入支付密码界面。">
</node>
<node TEXT="测试步骤：1. 输入部分支付密码后返回/取消。">
</node>
<node TEXT="预期结果：红包未发送，资金未发生变动。">
</node>
<node TEXT="验证点：红包消息中无发送">
</node>
<node TEXT="验证点：账户余额无变化">
</node>
</node>
<node TEXT="TC-018 输入红包金额为最小边界1分钱">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：账户余额&gt;=0.01元，已进入红包发送界面。">
</node>
<node TEXT="测试步骤：1. 输入红包金额0.01元，完成后发送。">
</node>
<node TEXT="预期结果：红包能正常发送，金额为0.01元。">
</node>
<node TEXT="验证点：红包发送成功">
</node>
<node TEXT="验证点：聊天中显示红包0.01元">
</node>
<node TEXT="验证点：资金变动正确">
</node>
</node>
<node TEXT="TC-019 输入金额含小数点后3位提示错误">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：已进入红包发送界面。">
</node>
<node TEXT="测试步骤：1. 输入金额1.001元。2. 尝试发送红包。">
</node>
<node TEXT="预期结果：系统校验金额格式，显示错误提示。">
</node>
<node TEXT="验证点：金额输入框提示格式错误">
</node>
<node TEXT="验证点：无法点击发送">
</node>
</node>
<node TEXT="TC-020 输入红包金额超过账户余额但小于200元">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：账户余额&lt;红包金额&lt;=200元。">
</node>
<node TEXT="测试步骤：1. 输入金额大于余额（如余额50元，输入100元）。2. 发送红包。">
</node>
<node TEXT="预期结果：发送失败，余额不足提示。">
</node>
<node TEXT="验证点：余额不足弹窗">
</node>
<node TEXT="验证点：红包未发送">
</node>
</node>
<node TEXT="TC-023 连续多次输入错误支付密码发送红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已进入支付密码输入界面。">
</node>
<node TEXT="测试步骤：1. 连续输错支付密码（如5次）。">
</node>
<node TEXT="预期结果：系统锁定支付功能一段时间，提示风险。">
</node>
<node TEXT="验证点：错误次数达到限制时弹窗提示">
</node>
<node TEXT="验证点：发送红包入口锁定/冻结">
</node>
</node>
<node TEXT="TC-024 发送红包时切换网络环境">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：已进入红包发送界面。">
</node>
<node TEXT="测试步骤：1. 输入金额，点击发送。2. 发送过程中切断网络再恢复。">
</node>
<node TEXT="预期结果：红包发送成功或失败有明确提示，资金无异常。">
</node>
<node TEXT="验证点：发送结果与资金变动保持一致">
</node>
<node TEXT="验证点：网络异常有明确提示">
</node>
</node>
</node>
<node TEXT="红包领取">
<node TEXT="TC-007 正常领取未拆的红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户收到未领取红包，网络正常。">
</node>
<node TEXT="测试步骤：1. 在聊天窗口点击红包消息。2. 点击“开”按钮。">
</node>
<node TEXT="预期结果：红包成功拆开，显示获得金额及相关动画。">
</node>
<node TEXT="验证点：红包页面展示抢到金额">
</node>
<node TEXT="验证点：红包状态变为已领取">
</node>
<node TEXT="验证点：余额增加正确">
</node>
</node>
<node TEXT="TC-008 已领完红包领取提示">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：红包已被其他人全部领取。">
</node>
<node TEXT="测试步骤：1. 用户在群聊收到红包。2. 点击红包消息。3. 点击“开”按钮。">
</node>
<node TEXT="预期结果：提示红包已被领完，无法领取。">
</node>
<node TEXT="验证点：&apos;红包已被领完&apos;提示显示">
</node>
<node TEXT="验证点：红包详情可查看">
</node>
</node>
<node TEXT="TC-009 红包已过期领取提示">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：收到过期（24小时以上）红包。">
</node>
<node TEXT="测试步骤：1. 打开过期红包。2. 尝试领取。">
</node>
<node TEXT="预期结果：系统提示红包已过期，无法领取。">
</node>
<node TEXT="验证点：&apos;红包已过期&apos;提示显示">
</node>
<node TEXT="验证点：不可领取，红包详情可查看">
</node>
</node>
<node TEXT="TC-010 同一红包多次点击领取">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：首次已领取该红包。">
</node>
<node TEXT="测试步骤：1. 再次点击已领取红包。2. 尝试再次拆开。">
</node>
<node TEXT="预期结果：提示已领取，无重复领取动作。">
</node>
<node TEXT="验证点：&apos;你已领取过该红包&apos;提示">
</node>
<node TEXT="验证点：红包详情页显示领取成功信息">
</node>
</node>
<node TEXT="TC-011 红包被发送方撤回后领取">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：收到已被撤回的红包。">
</node>
<node TEXT="测试步骤：1. 在聊天窗口点击红包。">
</node>
<node TEXT="预期结果：红包无法领取，显示被撤回提示。">
</node>
<node TEXT="验证点：红包撤回提示正确显示">
</node>
<node TEXT="验证点：无领取入口">
</node>
</node>
<node TEXT="TC-012 领取红包时网络异常">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：收到未领取红包，断网。">
</node>
<node TEXT="测试步骤：1. 尝试点击红包并领取。2. 网络断开或不稳定。">
</node>
<node TEXT="预期结果：提示网络异常，红包未被领取。">
</node>
<node TEXT="验证点：&apos;网络异常&apos;提示弹窗">
</node>
<node TEXT="验证点：无余额增加">
</node>
</node>
<node TEXT="TC-013 红包金额到账延迟">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：网络波动，领取红包。">
</node>
<node TEXT="测试步骤：1. 点击红包尝试领取。2. 出现网络波动后成功领取。">
</node>
<node TEXT="预期结果：红包到账有延迟，最终到账并收到通知。">
</node>
<node TEXT="验证点：延迟后显示&apos;红包到账&apos;通知">
</node>
<node TEXT="验证点：余额增加">
</node>
</node>
<node TEXT="TC-021 同一用户发出的自己红包不可领取">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户为红包发起者。">
</node>
<node TEXT="测试步骤：1. 在自己发出的红包消息上点击，尝试领取。">
</node>
<node TEXT="预期结果：可查看详情，但无法领取自己的红包余额。">
</node>
<node TEXT="验证点：自己红包无法领取">
</node>
<node TEXT="验证点：无&apos;抢红包&apos;操作">
</node>
</node>
<node TEXT="TC-022 红包页面切换应用后再回到微信">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：存在未领取红包，处于红包页面。">
</node>
<node TEXT="测试步骤：1. 切换到其他应用。2. 返回红包领取界面，继续操作。">
</node>
<node TEXT="预期结果：页面正常，红包状态未异常。">
</node>
<node TEXT="验证点：红包可继续领取">
</node>
<node TEXT="验证点：红包页面无异常刷新">
</node>
</node>
</node>
<node TEXT="红包详情">
<node TEXT="TC-014 查看红包的明细页">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：有待领取或已领取的红包。">
</node>
<node TEXT="测试步骤：1. 在聊天窗口打开红包后，点击“查看红包详情”或类似按钮。">
</node>
<node TEXT="预期结果：正确展示发放日期、金额、领取用户列表等信息。">
</node>
<node TEXT="验证点：明细页显示红包金额发放概览">
</node>
<node TEXT="验证点：包含领取/未领取名单及金额">
</node>
</node>
<node TEXT="TC-015 发送者可查看全部领取记录">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：自己为红包发送方，红包已被部分或全部领取。">
</node>
<node TEXT="测试步骤：1. 进入红包详情页面。">
</node>
<node TEXT="预期结果：页面展示每个用户领取金额、时间，未领取用户也有标注。">
</node>
<node TEXT="验证点：展示所有已领取用户及金额">
</node>
<node TEXT="验证点：未领取用户有灰色状态显示">
</node>
</node>
</node>
</node>
</map>