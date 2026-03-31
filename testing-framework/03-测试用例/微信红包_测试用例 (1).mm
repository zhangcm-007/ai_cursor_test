<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="微信红包">
<node TEXT="TC-001 正常发送微信红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信并开启红包权限；有充足余额。">
</node>
<node TEXT="测试步骤：进入微信聊天界面,点击“+”按钮，选择“红包”,输入红包金额,点击“塞钱进红包”,输入支付密码,发送红包">
</node>
<node TEXT="预期结果：红包成功发送到聊天界面，显示红包消息。">
</node>
<node TEXT="验证点：红包消息正常展示">
</node>
<node TEXT="验证点：点击红包可弹出【领取红包】界面">
</node>
<node TEXT="验证点：余额相应扣除">
</node>
</node>
<node TEXT="TC-002 红包金额超出限额提示">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信；余额充足。">
</node>
<node TEXT="测试步骤：进入聊天界面,选择“红包”,输入超出单笔最大限额的金额,尝试继续发送">
</node>
<node TEXT="预期结果：系统提示金额超出红包上限，红包无法发送。">
</node>
<node TEXT="验证点：红包金额输入框下出现超额提示">
</node>
<node TEXT="验证点：无法进入支付流程">
</node>
<node TEXT="验证点：余额无变化">
</node>
</node>
<node TEXT="TC-003 发送群红包-未填写红包金额禁用发送">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信；在群聊界面；红包金额输入框为空。">
</node>
<node TEXT="测试步骤：点击“+”选择“红包”,选择“普通红包”,不输入金额,观察是否可点击“塞钱进红包”按钮">
</node>
<node TEXT="预期结果：红包金额未填写时，发送按钮处于不可点击状态。">
</node>
<node TEXT="验证点：发送按钮为灰色 disabled 状态">
</node>
<node TEXT="验证点：无法进入支付页面">
</node>
</node>
<node TEXT="TC-004 发送口令红包流程">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已登录微信；在支持口令红包的聊天窗口。">
</node>
<node TEXT="测试步骤：点击“+”选择“红包”,选择“口令红包”,填写金额和口令,塞钱进红包并输入支付密码,完成红包发送">
</node>
<node TEXT="预期结果：聊天框内显示口令红包提示，需输入正确口令方可领取。">
</node>
<node TEXT="验证点：红包类型标识为口令红包">
</node>
<node TEXT="验证点：红包无法直接领取">
</node>
<node TEXT="验证点：输入正确口令后红包可被领取，金额到账">
</node>
</node>
<node TEXT="TC-005 余额不足无法发送红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户微信余额不足以支付红包金额。">
</node>
<node TEXT="测试步骤：进入聊天界面,选择“红包”,输入大于余额的金额,尝试发送红包">
</node>
<node TEXT="预期结果：系统提示余额不足，红包无法发送。">
</node>
<node TEXT="验证点：弹出余额不足提示">
</node>
<node TEXT="验证点：无法进入输入支付密码界面">
</node>
</node>
<node TEXT="TC-006 领取红包-正常流程">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：聊天界面收到可领取的红包。">
</node>
<node TEXT="测试步骤：点击红包消息,进入红包详情界面,点击“开”或“领取红包”按钮">
</node>
<node TEXT="预期结果：显示领取结果，金额自动进入零钱。">
</node>
<node TEXT="验证点：页面弹出“领取成功”提示">
</node>
<node TEXT="验证点：可在零钱明细查到账记录">
</node>
</node>
<node TEXT="TC-007 红包已被领完后的提示">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：收到的红包已全部被他人领取。">
</node>
<node TEXT="测试步骤：点击红包消息,进入红包详情">
</node>
<node TEXT="预期结果：页面显示红包已被领完的提示信息。">
</node>
<node TEXT="验证点：页面有【已被领完】或类似提示">
</node>
<node TEXT="验证点：领取按钮不可点击">
</node>
</node>
<node TEXT="TC-008 发送定额群红包-人数小于红包个数限制">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：在有3人参与的群聊中。">
</node>
<node TEXT="测试步骤：进入群聊,发送“普通红包”,设置红包个数大于当前群人数,尝试发送">
</node>
<node TEXT="预期结果：系统限制红包个数不能大于实际可领取人数。">
</node>
<node TEXT="验证点：红包个数输入有上限校验提示">
</node>
<node TEXT="验证点：无法完成红包发送">
</node>
</node>
<node TEXT="TC-009 网络异常时发送红包重试">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：已填写好红包参数，断开网络。">
</node>
<node TEXT="测试步骤：断网后点击“塞钱进红包”,恢复网络,尝试重新发送红包">
</node>
<node TEXT="预期结果：系统可在网络恢复后允许红包重新发送。">
</node>
<node TEXT="验证点：断网时发送红包失败，出现相关提示">
</node>
<node TEXT="验证点：网络恢复后可再次尝试，红包发送成功">
</node>
</node>
<node TEXT="TC-010 红包被领取后发送者收到通知">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：己发送红包，红包已被他人领取。">
</node>
<node TEXT="测试步骤：他人领取红包,观察发送者聊天界面和消息,进入红包详情页查看领取记录">
</node>
<node TEXT="预期结果：发送者收到红包已被领取或拆开的通知。">
</node>
<node TEXT="验证点：收到微信通知提示红包已被领取">
</node>
<node TEXT="验证点：红包记录显示具体领取人和金额">
</node>
</node>
<node TEXT="TC-011 发送个人微信红包-金额在有效范围内">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信，余额充足">
</node>
<node TEXT="测试步骤：进入微信聊天窗口,点击“+”号，选择“红包”,输入红包金额10元,输入红包祝福语,点击“塞钱进红包”并输入支付密码">
</node>
<node TEXT="预期结果：红包成功发出，聊天窗显示红包消息">
</node>
<node TEXT="验证点：红包发送成功提示出现">
</node>
<node TEXT="验证点：红包消息正常显示在聊天窗口">
</node>
<node TEXT="验证点：红包金额正确">
</node>
</node>
<node TEXT="TC-012 发送个人微信红包-金额为最小值0.01元">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信，余额充足">
</node>
<node TEXT="测试步骤：进入微信聊天窗口,点击“+”号，选择“红包”,输入红包金额0.01元,输入红包祝福语,点击“塞钱进红包”并输入支付密码">
</node>
<node TEXT="预期结果：红包成功发出，金额为0.01元">
</node>
<node TEXT="验证点：红包发送成功">
</node>
<node TEXT="验证点：红包金额显示为0.01元">
</node>
</node>
<node TEXT="TC-013 发送个人微信红包-金额超过最大值200元">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信，余额充足">
</node>
<node TEXT="测试步骤：进入微信聊天窗口,点击“+”号，选择“红包”,输入红包金额201元,点击“塞钱进红包”">
</node>
<node TEXT="预期结果：系统提示金额超出限制，不能继续下一步">
</node>
<node TEXT="验证点：金额限制提示弹出">
</node>
<node TEXT="验证点：无法发送红包">
</node>
</node>
<node TEXT="TC-014 发送群微信红包-随机金额，总额100元，10人">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户加入了一个有10人及以上的微信群，余额充足">
</node>
<node TEXT="测试步骤：进入微信群聊窗口,点击“+”号，选择“红包”,输入红包总金额100元,选择“塞钱进红包-拼手气”,输入红包数量10,输入祝福语,点击“塞钱进红包”并输入支付密码">
</node>
<node TEXT="预期结果：红包成功发出，显示为拼手气红包">
</node>
<node TEXT="验证点：群聊中出现红包消息">
</node>
<node TEXT="验证点：红包备注正确">
</node>
<node TEXT="验证点：红包类型为拼手气">
</node>
</node>
<node TEXT="TC-015 发送群微信红包-固定金额，总额100元，10人">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户加入了一个有10人及以上的微信群，余额充足">
</node>
<node TEXT="测试步骤：进入微信群聊窗口,点击“+”号，选择“红包”,选择“普通红包”,输入红包金额每人10元，数量10,输入祝福语,点击“塞钱进红包”并输入支付密码">
</node>
<node TEXT="预期结果：红包成功发出，显示为普通红包">
</node>
<node TEXT="验证点：红包类型为普通">
</node>
<node TEXT="验证点：每人红包10元">
</node>
<node TEXT="验证点：发送者信息正确">
</node>
</node>
<node TEXT="TC-016 红包领取-未领取红包用户点击红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户微信收到一个未领取的红包">
</node>
<node TEXT="测试步骤：在聊天窗口点击红包消息,点击“开”,查看领取结果">
</node>
<node TEXT="预期结果：用户领取到红包，金额显示到账">
</node>
<node TEXT="验证点：显示领取金额">
</node>
<node TEXT="验证点：微信零钱增加相应金额">
</node>
<node TEXT="验证点：领取人信息正确">
</node>
</node>
<node TEXT="TC-017 红包领取-红包已被领完">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户微信收到一个已被其他人领完的群红包">
</node>
<node TEXT="测试步骤：在聊天窗口点击红包消息,查看红包详情页">
</node>
<node TEXT="预期结果：提示红包已被领完，不能再领取">
</node>
<node TEXT="验证点：‘已被领完’提示显示">
</node>
<node TEXT="验证点：无法‘开红包’">
</node>
</node>
<node TEXT="TC-018 红包领取-红包已过期">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户微信收到一个过期的红包">
</node>
<node TEXT="测试步骤：在聊天窗口点击红包消息,查看红包详情页">
</node>
<node TEXT="预期结果：提示红包已过期，不能领取">
</node>
<node TEXT="验证点：‘已过期’提示显示">
</node>
<node TEXT="验证点：无法领取红包">
</node>
</node>
<node TEXT="TC-019 撤回未领取的个人红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户有一个发送后24小时未被领取的红包">
</node>
<node TEXT="测试步骤：等待红包过期（24小时）,查看余额,检查是否自动退回红包金额">
</node>
<node TEXT="预期结果：红包金额自动退回到零钱">
</node>
<node TEXT="验证点：零钱余额变更正确">
</node>
<node TEXT="验证点：系统消息提醒金额已退回">
</node>
</node>
<node TEXT="TC-020 发送红包时余额不足">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信，账户余额小于红包金额">
</node>
<node TEXT="测试步骤：进入微信红包发送界面,输入红包金额大于零钱余额,点击“塞钱进红包”">
</node>
<node TEXT="预期结果：系统提示余额不足，无法继续">
</node>
<node TEXT="验证点：‘余额不足’提示弹窗">
</node>
<node TEXT="验证点：红包未发送">
</node>
</node>
<node TEXT="TC-021 红包备注/祝福语输入最大限制（25字）">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已登录微信，当前在红包发送页面">
</node>
<node TEXT="测试步骤：输入超过25字的备注,尝试发送红包">
</node>
<node TEXT="预期结果：系统限制备注输入不超过25字，不能输入超限文字">
</node>
<node TEXT="验证点：备注输入有字数限制提示">
</node>
<node TEXT="验证点：只能输入25字">
</node>
</node>
<node TEXT="TC-022 发送群红包-红包数大于群人数">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：当前群人数不足红包数输入">
</node>
<node TEXT="测试步骤：进入微信群红包界面,输入红包数量大于群人数,尝试发送">
</node>
<node TEXT="预期结果：系统提示红包数不能超过群人数">
</node>
<node TEXT="验证点：红包数量有上限提示">
</node>
</node>
<node TEXT="TC-023 使用红包自动领取开关">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已开启红包自动领取功能">
</node>
<node TEXT="测试步骤：收到微信红包,观察红包自动领取行为">
</node>
<node TEXT="预期结果：红包被自动领取，显示到账信息">
</node>
<node TEXT="验证点：自动领取红包提示">
</node>
<node TEXT="验证点：零钱余额增加">
</node>
</node>
<node TEXT="TC-024 支付密码输错三次，发送红包失败">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信">
</node>
<node TEXT="测试步骤：进入红包发送界面,输入金额、祝福语,点击发送，输入三次错误支付密码">
</node>
<node TEXT="预期结果：发送失败，账户受限并提示需稍后再试">
</node>
<node TEXT="验证点：支付密码错误提示">
</node>
<node TEXT="验证点：红包未发送">
</node>
</node>
<node TEXT="TC-025 发送红包时网络异常">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信，处于无网络或网络波动状态">
</node>
<node TEXT="测试步骤：进入红包发送页面,输入金额、祝福语,点击发送，断网,观察系统提示">
</node>
<node TEXT="预期结果：系统提示网络异常，红包未发送">
</node>
<node TEXT="验证点：网络异常提示">
</node>
<node TEXT="验证点：红包消息未发出">
</node>
</node>
<node TEXT="TC-026 领取分享的普通红包（转发）">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户收到好友分享的红包链接">
</node>
<node TEXT="测试步骤：点击红包分享链接,尝试领取红包">
</node>
<node TEXT="预期结果：正常进入红包页面，可领取（如红包未领完）">
</node>
<node TEXT="验证点：红包详情正常显示">
</node>
<node TEXT="验证点：能否领取按红包状态显示">
</node>
</node>
<node TEXT="TC-027 发送口令红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群聊支持口令红包功能，余额充足">
</node>
<node TEXT="测试步骤：进入群聊红包界面,选择‘口令红包’,设置口令并输入金额、数量,发送红包">
</node>
<node TEXT="预期结果：群聊中出现口令红包消息">
</node>
<node TEXT="验证点：群里显示为口令红包">
</node>
<node TEXT="验证点：可正常被领取">
</node>
</node>
<node TEXT="TC-028 已领取的红包详情页面展示正确">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已领取红包">
</node>
<node TEXT="测试步骤：点击红包详情,查看该红包领取信息">
</node>
<node TEXT="预期结果：红包金额、领取者等信息展示正确">
</node>
<node TEXT="验证点：领取金额明细">
</node>
<node TEXT="验证点：领取人列表">
</node>
<node TEXT="验证点：发送者信息">
</node>
</node>
<node TEXT="TC-029 红包内容含特殊字符（表情、符号）">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已登录微信">
</node>
<node TEXT="测试步骤：输入包含表情、特殊符号的祝福语,发送红包">
</node>
<node TEXT="预期结果：红包发送成功，内容显示正常">
</node>
<node TEXT="验证点：表情/符号正常显示">
</node>
<node TEXT="验证点：未出现乱码">
</node>
</node>
<node TEXT="TC-030 同一用户多次领取同一群红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群红包未领完，用户已领取此红包一次">
</node>
<node TEXT="测试步骤：尝试第二次点击并领取同一红包">
</node>
<node TEXT="预期结果：系统不允许重复领取，给出相应提示">
</node>
<node TEXT="验证点：重复领取时有提示">
</node>
<node TEXT="验证点：仅允许领取一次">
</node>
</node>
<node TEXT="TC-031 红包进入零钱明细页正确显示">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已成功领取红包">
</node>
<node TEXT="测试步骤：进入零钱明细页面,查找领取红包的记录">
</node>
<node TEXT="预期结果：零钱明细中有对应的红包入账流水">
</node>
<node TEXT="验证点：红包入账记录显示">
</node>
<node TEXT="验证点：金额和时间准确">
</node>
</node>
<node TEXT="TC-032 红包被拦截风控（已被限发封禁）">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户因风控原因临时无法发红包">
</node>
<node TEXT="测试步骤：尝试发送红包,观察系统反馈">
</node>
<node TEXT="预期结果：系统提示因安全原因无法发红包">
</node>
<node TEXT="验证点：风控限制提示清晰可见">
</node>
</node>
</node>
</map>