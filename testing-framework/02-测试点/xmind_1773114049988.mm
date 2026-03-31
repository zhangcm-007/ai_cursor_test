<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="红包">
<node TEXT="TP-01">
<node TEXT="TC-001 正常输入整数金额（如100）发送红包，验证红包创建成功且金额显示正确">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：登录微信账号，零钱余额≥100元，网络正常">
</node>
<node TEXT="测试步骤：1. 进入聊天窗口 → 点击+号 → 选择‘红包’； 2. 在金额输入框输入‘100’； 3. 输入祝福语，点击‘塞钱进红包’； 4. 确认支付密码完成发送">
</node>
<node TEXT="预期结果：红包发送成功；聊天窗口显示红包卡片，金额明确标注为¥100.00；对方收到带¥100.00标识的红包消息">
</node>
</node>
<node TEXT="TC-001 正常输入整数金额（如100）发送红包，验证红包创建成功且金额显示正确">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信，零钱余额≥100元；处于单聊或群聊发红包入口">
</node>
<node TEXT="测试步骤：1. 进入红包发送页面；2. 输入金额&apos;100&apos;；3. 点击&apos;塞钱进红包&apos;；4. 确认支付">
</node>
<node TEXT="预期结果：红包创建成功，聊天窗口显示红包卡片，金额显示为&apos;¥100.00&apos;，红包详情页金额字段为&apos;100.00&apos;">
</node>
</node>
</node>
<node TEXT="TP-02">
<node TEXT="TC-002 输入含两位小数的金额（如99.99）发送红包，验证金额精度保留且到账准确">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信，零钱余额≥99.99元；处于红包发送页">
</node>
<node TEXT="测试步骤：1. 在金额输入框输入&apos;99.99&apos;；2. 完成后续发送流程">
</node>
<node TEXT="预期结果：红包发出成功，接收方领取后零钱入账金额为&apos;¥99.99&apos;，账单明细中金额精确显示&apos;99.99&apos;，无四舍五入或截断">
</node>
</node>
</node>
<node TEXT="TP-03">
<node TEXT="TC-003 输入最小合法金额0.01，验证红包可成功发出">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：登录微信账号，零钱余额≥0.01元，网络正常">
</node>
<node TEXT="测试步骤：1. 进入红包发送页； 2. 输入‘0.01’； 3. 完成发送流程">
</node>
<node TEXT="预期结果：红包成功发出，聊天中显示¥0.01；对方可正常领取，到账0.01元">
</node>
</node>
<node TEXT="TC-003 输入最小合法金额0.01，验证红包可成功发出">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户零钱余额≥0.01元；网络正常">
</node>
<node TEXT="测试步骤：1. 输入金额&apos;0.01&apos;；2. 发送红包">
</node>
<node TEXT="预期结果：红包发送成功，聊天窗显示&apos;¥0.01&apos;红包卡片，对方可正常领取并到账0.01元">
</node>
</node>
</node>
<node TEXT="TP-04">
<node TEXT="TC-004 输入最大单个红包金额200.00，验证红包可成功发出">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：登录微信账号，零钱余额≥200.00元，网络正常">
</node>
<node TEXT="测试步骤：1. 进入红包发送页； 2. 输入‘200.00’； 3. 完成发送流程">
</node>
<node TEXT="预期结果：红包成功发出，金额显示为¥200.00；对方领取后到账200.00元">
</node>
</node>
<node TEXT="TC-004 输入最大单个红包金额200.00，验证红包可成功发出">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户零钱余额≥200.00元">
</node>
<node TEXT="测试步骤：1. 输入金额&apos;200.00&apos;；2. 完成发送流程">
</node>
<node TEXT="预期结果：红包成功发出，金额显示为&apos;¥200.00&apos;，无超限提示，领取后到账200.00元">
</node>
</node>
</node>
<node TEXT="TP-05">
<node TEXT="TC-005 输入超过200.00的金额（如200.01），验证系统提示金额超限并阻止发送">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：登录微信账号，网络正常">
</node>
<node TEXT="测试步骤：1. 进入红包发送页； 2. 输入‘200.01’； 3. 尝试点击‘塞钱进红包’">
</node>
<node TEXT="预期结果：按钮置灰或点击后弹出toast提示：‘单个红包金额不能超过200元’，无法进入支付环节">
</node>
</node>
<node TEXT="TC-005 输入超过200.00的金额（如200.01），验证系统提示金额超限并阻止发送">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户处于红包金额输入页">
</node>
<node TEXT="测试步骤：1. 输入&apos;200.01&apos;；2. 尝试点击&apos;塞钱进红包&apos;">
</node>
<node TEXT="预期结果：按钮置灰或点击后弹出Toast提示&apos;单个红包金额不能超过200元&apos;，无法进入支付环节">
</node>
</node>
</node>
<node TEXT="TP-06">
<node TEXT="TC-006 输入0或负数（如0、-1、-5.5），验证系统拒绝发送并给出明确错误提示">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：登录微信账号，网络正常">
</node>
<node TEXT="测试步骤：1. 进入红包发送页； 2. 分别输入‘0’、‘-1’、‘-5.5’； 3. 尝试提交">
</node>
<node TEXT="预期结果：任一非法值输入后，‘塞钱进红包’按钮不可点击；或点击后弹出提示：‘金额必须大于0.01元’">
</node>
</node>
<node TEXT="TC-006 输入0或负数（如0、-1、-5.5），验证系统拒绝发送并给出明确错误提示">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户处于红包金额输入页">
</node>
<node TEXT="测试步骤：1. 分别输入&apos;0&apos;、&apos;-1&apos;、&apos;-5.5&apos;；2. 尝试提交">
</node>
<node TEXT="预期结果：输入框实时校验失败，显示红色提示&apos;请输入大于0的金额&apos;或类似文案；&apos;塞钱进红包&apos;按钮不可点击">
</node>
</node>
</node>
<node TEXT="TP-07">
<node TEXT="TC-007 输入非数字字符（如&apos;abc&apos;、&apos;100元&apos;、&apos;100. &apos;），验证输入校验失败并阻止提交">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：登录微信账号，网络正常">
</node>
<node TEXT="测试步骤：1. 进入红包发送页； 2. 输入‘abc’； 3. 尝试提交； 4. 同样测试‘100元’、‘100. ’">
</node>
<node TEXT="预期结果：输入框实时过滤或失焦时清空/标红；提交按钮禁用；无支付流程触发">
</node>
</node>
<node TEXT="TC-007 输入非数字字符（如&apos;abc&apos;、&apos;100元&apos;、&apos;100. &apos;），验证输入校验失败并阻止提交">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户处于红包金额输入页">
</node>
<node TEXT="测试步骤：1. 输入&apos;abc&apos;；2. 输入&apos;100元&apos;；3. 输入&apos;100. &apos;；4. 尝试继续操作">
</node>
<node TEXT="预期结果：输入框自动过滤/清空非法字符；焦点离开或点击时提示&apos;请输入有效金额&apos;；无法进入下一步">
</node>
</node>
</node>
<node TEXT="TP-08">
<node TEXT="TC-008 输入带多余小数位的金额（如100.123），验证系统自动截断或提示格式错误">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：登录微信账号，网络正常">
</node>
<node TEXT="测试步骤：1. 进入红包发送页； 2. 输入‘100.123’； 3. 失焦或尝试提交">
</node>
<node TEXT="预期结果：输入框自动修正为‘100.12’并高亮提示‘仅支持两位小数’；或提交时弹出格式错误提示">
</node>
</node>
<node TEXT="TC-008 输入带多余小数位的金额（如100.123），验证系统自动截断或提示格式错误">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户处于红包金额输入页">
</node>
<node TEXT="测试步骤：1. 输入&apos;100.123&apos;；2. 失去焦点或点击确认">
</node>
<node TEXT="预期结果：系统自动修正为&apos;100.12&apos;并高亮提示&apos;已为您保留两位小数&apos;；或弹出提示&apos;金额最多支持两位小数&apos;，禁止提交">
</node>
</node>
</node>
<node TEXT="TP-09">
<node TEXT="TC-009 单聊场景下向单个好友发送红包，验证对方收到红包消息且可正常领取">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：A与B互为好友；A零钱充足；B在线">
</node>
<node TEXT="测试步骤：1. A在与B的单聊窗口发送¥50红包； 2. B查看聊天窗口； 3. B点击红包并输入密码领取">
</node>
<node TEXT="预期结果：B收到含红包图标和金额的卡片消息；点击后进入领取页，输入密码后提示‘领取成功’，零钱增加¥50">
</node>
</node>
<node TEXT="TC-009 单聊场景下向单个好友发送红包，验证对方收到红包消息且可正常领取">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：A与B互为好友；A零钱充足；B在线">
</node>
<node TEXT="测试步骤：1. A在与B的聊天窗口点击+→红包；2. 输入金额发送；3. B查看聊天窗并点击红包">
</node>
<node TEXT="预期结果：B收到红包卡片消息，点击后进入领取页，点击&apos;开&apos;后立即显示&apos;恭喜发财，大吉大利&apos;，零钱增加对应金额，账单新增红包收入记录">
</node>
</node>
</node>
<node TEXT="TP-10">
<node TEXT="TC-010 群聊场景下发送拼手气红包（n人n份），验证红包总金额与各份额之和一致，且随机分配逻辑合理">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：3人以上群聊，群成员均在线；发包人零钱充足">
</node>
<node TEXT="测试步骤：1. 在群中发送¥10拼手气红包（3人）； 2. 3人均领取； 3. 查看各自到账金额及红包详情页的分配明细">
</node>
<node TEXT="预期结果：三人领取金额分别为x、y、z，满足x+y+z=10.00；各金额均≥0.01且不完全相等；分配无明显偏向性（如未出现连续两次最大额同一人）">
</node>
</node>
<node TEXT="TC-010 群聊场景下发送拼手气红包（如100元分5份），验证各成员领取金额随机且总和等于设定值">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：5人以上活跃群；发红包人零钱≥100元">
</node>
<node TEXT="测试步骤：1. 群内发送100元拼手气红包（5份）；2. 5名成员依次领取">
</node>
<node TEXT="预期结果：5人领取金额各不相同（如23.55, 18.90, 30.12, 15.78, 11.65），总和=100.00；红包详情页显示&apos;已领取5份，总额¥100.00&apos;">
</node>
</node>
</node>
<node TEXT="TP-11">
<node TEXT="TC-011 群聊中发送普通红包（n人等额），验证每人分得金额相等且无误差（考虑分账精度）">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群内5人；发送¥10等额红包">
</node>
<node TEXT="测试步骤：1. 发送‘普通红包’，设置总金额10.00，人数5； 2. 5人依次领取">
</node>
<node TEXT="预期结果：每人领取后零钱均增加¥2.00；红包详情页显示‘每人2.00元’；总额10.00无分账损耗或精度丢失">
</node>
</node>
<node TEXT="TC-011 群聊发送普通红包（如100元分5份固定100/5=20元），验证每人领取金额均为20元">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群内发送普通红包（均分）；5人在线">
</node>
<node TEXT="测试步骤：1. 选择&apos;普通红包&apos;类型；2. 输入100元，份数填5；3. 发送；4. 5人依次领取">
</node>
<node TEXT="预期结果：每人领取后零钱均增加20.00元；账单明细显示&apos;红包收入 ¥20.00&apos;；红包详情页显示&apos;每份¥20.00&apos;">
</node>
</node>
</node>
<node TEXT="TP-12">
<node TEXT="TC-012 红包未被领取前撤回操作，验证撤回成功且红包失效、余额返还">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：A发送红包至单聊/B群聊，尚未被任何人领取；A处于可操作状态">
</node>
<node TEXT="测试步骤：1. A长按已发出未领取的红包； 2. 选择‘撤回’； 3. 确认撤回">
</node>
<node TEXT="预期结果：红包卡片消失，显示‘该红包已撤回’；A零钱余额恢复原金额；对方聊天中红包不可见或显示已撤回">
</node>
</node>
<node TEXT="TC-012 红包未被领取前撤回操作，验证撤回成功且红包失效、余额返还">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：红包已发出但0人领取；发红包人在聊天窗口长按该红包">
</node>
<node TEXT="测试步骤：1. 长按红包卡片；2. 选择&apos;撤回&apos;；3. 确认撤回">
</node>
<node TEXT="预期结果：红包卡片消失，显示&apos;该红包已撤回&apos;；发红包人零钱余额恢复原金额；对方聊天窗该消息变为&apos;红包已撤回&apos;灰色提示">
</node>
</node>
</node>
<node TEXT="TP-13">
<node TEXT="TC-013 红包已被部分领取后尝试撤回，验证系统禁止撤回并提示‘已领取不可撤回’">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：A在5人群发¥10拼手气红包，2人已领取">
</node>
<node TEXT="测试步骤：1. A长按该红包； 2. 尝试点击‘撤回’">
</node>
<node TEXT="预期结果：撤回选项置灰不可选；或点击后弹出toast：‘红包已被领取，无法撤回’">
</node>
</node>
<node TEXT="TC-013 红包已被部分领取后尝试撤回，验证系统禁止撤回并提示“已有领取不可撤回”">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：红包已发出，1人已领取">
</node>
<node TEXT="测试步骤：1. 发红包人长按红包卡片；2. 点击&apos;撤回&apos;">
</node>
<node TEXT="预期结果：弹出提示框&apos;该红包已有成员领取，无法撤回&apos;；撤回操作被拒绝；红包状态保持&apos;已领取X份&apos;">
</node>
</node>
</node>
<node TEXT="TP-14">
<node TEXT="TC-014 同一用户在不同设备同时打开红包领取页，验证仅首次点击有效，其余提示‘手慢了，红包已被领完’">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户A在手机A与手机B均登录同一微信账号；A收到一个仅剩1份的群红包">
</node>
<node TEXT="测试步骤：1. A在手机A与手机B几乎同时点击同一红包； 2. 观察两设备反馈">
</node>
<node TEXT="预期结果：先响应的设备完成领取并显示‘领取成功’；后响应设备跳转至红包详情页并提示‘手慢了，红包已被领完’">
</node>
</node>
<node TEXT="TC-014 红包过期（24小时未领完），验证剩余未领金额自动退回到发红包人钱包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：红包发出满24小时，仅部分领取（如5份领2份）">
</node>
<node TEXT="测试步骤：等待24小时后检查发红包人零钱及红包状态">
</node>
<node TEXT="预期结果：未领取的3份金额（如60.00元）全额退至发红包人零钱；红包卡片显示&apos;已过期&apos;；详情页状态为&apos;已过期，金额已退回&apos;">
</node>
</node>
</node>
<node TEXT="TP-15">
<node TEXT="TC-015 网络中断情况下点击领取红包，验证有重试机制及离线状态友好提示">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户处于Wi-Fi/移动网络关闭状态；已进入红包领取页">
</node>
<node TEXT="测试步骤：1. 断网后点击‘开’按钮； 2. 等待3秒； 3. 恢复网络后观察">
</node>
<node TEXT="预期结果：立即显示‘网络连接失败，请检查网络’及‘重试’按钮；点击重试后网络恢复即自动提交；领取成功后状态同步">
</node>
</node>
<node TEXT="TC-015 收红包时网络中断，验证重新联网后可继续领取或查看状态">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户点击红包领取页时主动断网">
</node>
<node TEXT="测试步骤：1. 点击红包进入领取页；2. 断开Wi-Fi/移动网络；3. 点击&apos;开&apos;；4. 恢复网络">
</node>
<node TEXT="预期结果：断网时显示&apos;网络连接失败，请重试&apos;按钮；恢复网络后点击重试，成功领取并显示结果；或自动重连后完成领取">
</node>
</node>
</node>
<node TEXT="TP-16">
<node TEXT="TC-016 红包有效期为24小时，验证超时后红包自动退回原账户且状态更新为‘已过期’">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：A发送红包，记录发送时间T；系统时间可模拟推进">
</node>
<node TEXT="测试步骤：1. 发送¥10红包； 2. 使用工具将设备时间调快24h01m； 3. 查看红包状态及A零钱余额">
</node>
<node TEXT="预期结果：红包卡片显示‘已过期’；A零钱余额增加¥10；聊天中红包不可点击">
</node>
</node>
<node TEXT="TC-016 同一用户在多个设备登录，验证红包仅能被领取一次（防重复领取）">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户A在手机A、手机B、iPad三端同时登录同一微信账号；A收到他人发送的红包">
</node>
<node TEXT="测试步骤：1. 在手机A点击红包并领取成功；2. 立即在手机B/iPad打开同一红包链接">
</node>
<node TEXT="预期结果：手机B/iPad显示&apos;手慢了，红包已被领完&apos;，无法二次领取；零钱仅增加一次；账单仅一条收入记录">
</node>
</node>
</node>
<node TEXT="TP-17">
<node TEXT="TC-017 发送红包时微信零钱余额不足，验证支付失败并提示‘余额不足，请充值’">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：A零钱余额为¥5.00；尝试发送¥10红包">
</node>
<node TEXT="测试步骤：1. 输入¥10并点击‘塞钱进红包’； 2. 输入支付密码">
</node>
<node TEXT="预期结果：支付失败；弹出提示：‘零钱余额不足，请先充值’；余额未扣减">
</node>
</node>
<node TEXT="TC-017 发红包时微信余额不足，验证支付失败并提示“余额不足，请充值”">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户零钱余额&lt;待发红包金额">
</node>
<node TEXT="测试步骤：1. 输入金额（如100）；2. 点击&apos;塞钱进红包&apos;；3. 进入支付页确认">
</node>
<node TEXT="预期结果：支付页显示&apos;零钱余额不足&apos;红字提示；&apos;确认支付&apos;按钮置灰；点击后弹出&apos;余额不足，请充值&apos;引导弹窗">
</node>
</node>
</node>
<node TEXT="TP-18">
<node TEXT="TC-018 使用绑定的银行卡支付红包，验证扣款成功、交易记录可查且红包正常发出">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：A已绑定有效银行卡；银行卡余额充足；零钱余额&lt;红包金额">
</node>
<node TEXT="测试步骤：1. 发送¥100红包； 2. 在支付页选择‘银行卡’； 3. 输入银行卡密码完成支付">
</node>
<node TEXT="预期结果：支付成功；红包正常发出；微信支付账单中显示该笔银行卡支出；红包到账方接收正常">
</node>
</node>
<node TEXT="TC-018 使用绑定的银行卡支付发红包，验证扣款成功且红包正常发出">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已绑卡且卡内余额充足；零钱余额&lt;红包金额">
</node>
<node TEXT="测试步骤：1. 输入红包金额；2. 在支付页选择&apos;银行卡&apos;；3. 输入密码完成支付">
</node>
<node TEXT="预期结果：支付成功，红包正常发出；账单显示&apos;红包支出&apos;来源为该银行卡；零钱无扣减；红包可被正常领取">
</node>
</node>
</node>
<node TEXT="TP-19">
<node TEXT="TC-019 红包领取后，验证领取金额实时入账至零钱，且账单明细中显示红包来源和时间">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：B领取A发送的¥88红包">
</node>
<node TEXT="测试步骤：1. B领取红包； 2. 进入‘服务’→‘钱包’→‘零钱’→‘账单’">
</node>
<node TEXT="预期结果：零钱余额实时+88.00；账单中新增一条记录：收入类型‘红包’，对方昵称‘A’，时间精确到秒，金额¥88.00">
</node>
</node>
<node TEXT="TC-019 红包详情页显示发送人昵称、时间、金额、领取状态，验证信息完整准确">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已领取一个红包">
</node>
<node TEXT="测试步骤：1. 进入微信钱包→红包→我的红包；2. 点击任一已领取红包进入详情页">
</node>
<node TEXT="预期结果：详情页清晰展示：发送人昵称（非微信号）、发送时间（精确到秒）、红包总金额、本人领取金额、当前领取状态（如&apos;已领取&apos;）、领取时间（精确到秒）">
</node>
</node>
</node>
<node TEXT="TP-20">
<node TEXT="TC-020 发送红包时开启‘祝福语’并含特殊字符（如emoji、中文、英文、空格混合），验证保存与展示正常无乱码">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：网络正常；支持Unicode渲染">
</node>
<node TEXT="测试步骤：1. 发送红包时祝福语输入：‘🎉新年快乐！Hello 世界 😊  ’（含emoji、中英、空格）； 2. 发送并由对方查看">
</node>
<node TEXT="预期结果：发送页输入框正确显示全部字符；红包卡片上祝福语完整、无方框/问号/乱码；对方端同样正常渲染">
</node>
</node>
<node TEXT="TC-020 无障碍模式下使用屏幕朗读功能访问红包界面，验证关键信息（金额、按钮）可被正确识别和播报">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：Android/iOS已开启TalkBack/VoiceOver；微信权限已授权">
</node>
<node TEXT="测试步骤：1. 使用TalkBack打开红包领取页；2. 滑动遍历界面元素">
</node>
<node TEXT="预期结果：屏幕朗读器依次准确播报：&apos;红包金额 ¥99.99&apos;、&apos;开红包按钮&apos;、&apos;发送人张三&apos;、&apos;发送时间 2023年10月5日 14:30&apos;、&apos;剩余1份&apos;等关键语义信息，无&apos;Image&apos;、&apos;Button1&apos;等无效描述">
</node>
</node>
</node>
</node>
</map>