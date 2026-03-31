<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="红包">
<node TEXT="TP-31">
<node TEXT="TC-001 发送1元红包给单个好友">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信且有1元以上余额。">
</node>
<node TEXT="测试步骤：进入微信聊天页面，选择一个好友,点击“+”，选择“红包”,输入金额1元，确认发送,完成付款">
</node>
<node TEXT="预期结果：红包发送成功，聊天界面显示红包消息。">
</node>
<node TEXT="验证点：红包金额为1元">
</node>
<node TEXT="验证点：红包可被好友领取">
</node>
<node TEXT="验证点：红包显示在聊天记录中">
</node>
</node>
</node>
<node TEXT="TP-32">
<node TEXT="TC-002 发送单个200元红包给好友">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信且有200元以上余额。">
</node>
<node TEXT="测试步骤：进入与好友的聊天界面,选择发送红包功能,输入金额200元，确认发送,完成支付">
</node>
<node TEXT="预期结果：红包发送成功，金额为200元。">
</node>
<node TEXT="验证点：红包金额为200元">
</node>
<node TEXT="验证点：红包显示为单个红包">
</node>
<node TEXT="验证点：好友可正常领取">
</node>
</node>
</node>
<node TEXT="TP-33">
<node TEXT="TC-003 发送0.01元红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信且有0.01元以上余额。">
</node>
<node TEXT="测试步骤：选择好友,发起红包，输入0.01元，确认发送,完成付款">
</node>
<node TEXT="预期结果：红包发送成功，金额为0.01元。">
</node>
<node TEXT="验证点：红包金额为0.01元">
</node>
<node TEXT="验证点：红包可显示并被领取">
</node>
</node>
</node>
<node TEXT="TP-34">
<node TEXT="TC-004 自定义金额发送红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信。">
</node>
<node TEXT="测试步骤：进入红包发送页面,输入自定义金额（如88.88元）,确认无金额异常，发送红包完成付款">
</node>
<node TEXT="预期结果：红包发送成功，金额为自定义值。">
</node>
<node TEXT="验证点：红包金额等于输入金额">
</node>
<node TEXT="验证点：显示自定义金额">
</node>
<node TEXT="验证点：领取后金额与输入一致">
</node>
</node>
</node>
<node TEXT="TP-35">
<node TEXT="TC-005 发送带祝福语的红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已登录微信。">
</node>
<node TEXT="测试步骤：进入红包发送界面,输入祝福语，比如“新年快乐”,填写金额，完成发送">
</node>
<node TEXT="预期结果：红包呈现祝福语内容，好友可见。">
</node>
<node TEXT="验证点：收到的红包包含祝福语">
</node>
<node TEXT="验证点：祝福语内容正确显示">
</node>
</node>
</node>
<node TEXT="TP-36">
<node TEXT="TC-006 余额不足时提示充值">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户余额小于红包金额。">
</node>
<node TEXT="测试步骤：输入红包金额大于当前余额,尝试发送红包">
</node>
<node TEXT="预期结果：系统弹窗提示余额不足并引导充值。">
</node>
<node TEXT="验证点：系统弹出余额不足提示">
</node>
<node TEXT="验证点：充值入口可点击">
</node>
</node>
</node>
<node TEXT="TP-37">
<node TEXT="TC-007 网络异常发送红包失败并提示重试">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录，网络断开。">
</node>
<node TEXT="测试步骤：发起红包，输入任意正确金额,尝试发送，观察系统提示">
</node>
<node TEXT="预期结果：发送失败，系统提示网络异常并建议重试。">
</node>
<node TEXT="验证点：系统弹出网络异常提示">
</node>
<node TEXT="验证点：有‘重试’或‘刷新’按钮">
</node>
</node>
</node>
<node TEXT="TP-38">
<node TEXT="TC-008 取消未付款红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已发起红包但尚未付款。">
</node>
<node TEXT="测试步骤：发起红包流程但不立即付款,在支付页面点击‘取消’">
</node>
<node TEXT="预期结果：红包未创建且无扣款，系统返回红包发送页。">
</node>
<node TEXT="验证点：无扣款记录">
</node>
<node TEXT="验证点：红包记录未显示为已发送">
</node>
<node TEXT="验证点：用户回到原界面">
</node>
</node>
</node>
<node TEXT="TP-39">
<node TEXT="TC-009 查看已发送红包的状态">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已发送一个或多个红包。">
</node>
<node TEXT="测试步骤：进入聊天详情,点击红包消息查看状态">
</node>
<node TEXT="预期结果：显示红包领取状态：已领取/未领取/已退回。">
</node>
<node TEXT="验证点：红包状态展示正确">
</node>
<node TEXT="验证点：退回显示明细">
</node>
</node>
</node>
<node TEXT="TP-40">
<node TEXT="TC-010 用户正常领取红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：账号收到一个红包。">
</node>
<node TEXT="测试步骤：点击红包消息,点击“开”按钮领取红包">
</node>
<node TEXT="预期结果：红包金额到账，状态变为已领取。">
</node>
<node TEXT="验证点：用户余额增加">
</node>
<node TEXT="验证点：红包状态显示已领取">
</node>
</node>
</node>
<node TEXT="TP-41">
<node TEXT="TC-011 用户尝试重复领取红包提示已领取">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：红包已被当前用户领取。">
</node>
<node TEXT="测试步骤：再次点击同一红包消息,观察系统提示">
</node>
<node TEXT="预期结果：系统提示‘已领取’，无法重复领取。">
</node>
<node TEXT="验证点：红包点击后不再弹出领取界面">
</node>
<node TEXT="验证点：提示‘已领取’">
</node>
</node>
</node>
<node TEXT="TP-42">
<node TEXT="TC-012 领取红包过程中网络异常后能查询红包领取状态">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：收到红包，领取过程中断网。">
</node>
<node TEXT="测试步骤：点击红包时关闭网络,领取操作后恢复网络,查询红包当前状态">
</node>
<node TEXT="预期结果：系统准确显示红包的实际领取状态。">
</node>
<node TEXT="验证点：红包状态与实际一致（已领取或未领取）">
</node>
<node TEXT="验证点：没有错误金额或状态">
</node>
</node>
</node>
<node TEXT="TP-43">
<node TEXT="TC-013 24小时内未领取红包自动退回">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：红包发送超过24小时且未被领取。">
</node>
<node TEXT="测试步骤：等待24小时未领取红包,查看红包状态和余额变动">
</node>
<node TEXT="预期结果：红包金额自动退回到发起者余额。">
</node>
<node TEXT="验证点：发起人收到退款通知">
</node>
<node TEXT="验证点：红包状态显示已退回">
</node>
</node>
</node>
<node TEXT="TP-44">
<node TEXT="TC-014 红包金额小数点后超过两位报错提示">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户进入红包发送页面。">
</node>
<node TEXT="测试步骤：输入金额0.001元或2.999元,尝试发送红包">
</node>
<node TEXT="预期结果：系统校验失败，提示金额无效。">
</node>
<node TEXT="验证点：弹窗或下方报错‘金额输入有误’">
</node>
<node TEXT="验证点：禁止发送按钮激活">
</node>
</node>
</node>
<node TEXT="TP-45">
<node TEXT="TC-015 红包金额为0或负数提示报错，无法发送">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户进入红包发送页面。">
</node>
<node TEXT="测试步骤：输入金额为0元或-1元,尝试发送红包">
</node>
<node TEXT="预期结果：系统校验失败，禁止发送，提示金额错误。">
</node>
<node TEXT="验证点：弹窗‘金额需大于0’">
</node>
<node TEXT="验证点：发送按钮不可用">
</node>
</node>
</node>
<node TEXT="TP-46">
<node TEXT="TC-016 短时间内发送多个红包未触发风控">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已登录，余额充足。">
</node>
<node TEXT="测试步骤：30秒内连续给不同好友发送3个红包（金额正常）">
</node>
<node TEXT="预期结果：红包均发送成功，无风控提示。">
</node>
<node TEXT="验证点：无验证码、无风控弹窗">
</node>
<node TEXT="验证点：红包全部发送成功">
</node>
</node>
</node>
<node TEXT="TP-47">
<node TEXT="TC-017 短时间内大量发送红包触发风控">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录，余额充足。">
</node>
<node TEXT="测试步骤：1分钟内连续发送30个红包">
</node>
<node TEXT="预期结果：系统限制发送并提示风控相关信息。">
</node>
<node TEXT="验证点：弹出风控提示或要求验证码">
</node>
<node TEXT="验证点：部分红包发送失败">
</node>
</node>
</node>
<node TEXT="TP-48">
<node TEXT="TC-018 好友聊天页面正常发送红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已登录。">
</node>
<node TEXT="测试步骤：在微信与好友聊天界面打开‘红包’功能,发送红包">
</node>
<node TEXT="预期结果：红包正常发送，显示在聊天框。">
</node>
<node TEXT="验证点：红包消息显示在聊天界面">
</node>
<node TEXT="验证点：流程顺畅无异常">
</node>
</node>
</node>
<node TEXT="TP-49">
<node TEXT="TC-019 群聊中发送拼手气红包可被多人领取，金额随机分配">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：已加入微信群，群成员不小于2人。">
</node>
<node TEXT="测试步骤：在群聊界面选择‘拼手气红包’,输入金额和分发人数（如100元5人）,发送红包,多位用户分别领取">
</node>
<node TEXT="预期结果：金额随机分配，多用户成功领取。">
</node>
<node TEXT="验证点：各个用户领取金额不一致">
</node>
<node TEXT="验证点：拼手气明细可查看">
</node>
<node TEXT="验证点：红包领取人数受限于设置人数">
</node>
</node>
</node>
<node TEXT="TP-50">
<node TEXT="TC-020 红包过程用户信息和金额加密传输">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：准备抓包工具监控网络。">
</node>
<node TEXT="测试步骤：发起红包发送及领取操作,使用抓包工具查看传输数据">
</node>
<node TEXT="预期结果：敏感信息如金额及用户身份信息均加密传输，无法明文读取。">
</node>
<node TEXT="验证点：金额字段密文展示">
</node>
<node TEXT="验证点：用户ID及个人信息加密">
</node>
<node TEXT="验证点：无明文个人数据">
</node>
</node>
</node>
</node>
</map>