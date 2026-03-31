<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="微信红包">
<node TEXT="个人红包">
<node TEXT="发送个人红包">
<node TEXT="TC-001 发送带有祝福语的个人红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信并进入好友聊天界面，账户余额充足">
</node>
<node TEXT="测试步骤：点击聊天界面“+”按钮,选择“红包”功能,输入金额和祝福语，点击发送">
</node>
<node TEXT="预期结果：红包成功发送到好友聊天窗口">
</node>
<node TEXT="验证点：红包在聊天窗口显示">
</node>
<node TEXT="验证点：祝福语内容正确">
</node>
<node TEXT="验证点：红包金额正确">
</node>
</node>
<node TEXT="TC-002 发送最低金额的个人红包（最小边界）">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信并进入好友聊天界面，账户余额充足">
</node>
<node TEXT="测试步骤：点击聊天界面“+”按钮,选择“红包”功能,输入最小允许金额，点击发送">
</node>
<node TEXT="预期结果：红包发送成功，金额显示为系统允许的最小值">
</node>
<node TEXT="验证点：红包金额为最小值">
</node>
<node TEXT="验证点：红包正常发送">
</node>
</node>
<node TEXT="TC-003 发送超出最大金额的个人红包（金额过大）">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信并进入好友聊天界面，账户余额充足">
</node>
<node TEXT="测试步骤：点击聊天界面“+”按钮,选择“红包”功能,输入超过允许最大金额，点击发送">
</node>
<node TEXT="预期结果：系统提示红包金额超出最大限制，红包发送失败">
</node>
<node TEXT="验证点：金额校验提示正确">
</node>
<node TEXT="验证点：红包未发送">
</node>
</node>
<node TEXT="TC-004 余额不足时发送个人红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信并进入好友聊天界面，余额小于红包额度">
</node>
<node TEXT="测试步骤：进入红包发送界面并输入金额超出余额的红包,点击发送">
</node>
<node TEXT="预期结果：系统提示余额不足，红包发送失败">
</node>
<node TEXT="验证点：余额不足提示显示">
</node>
<node TEXT="验证点：红包未发送">
</node>
</node>
<node TEXT="TC-005 发送无祝福语的个人红包（祝福语可为空）">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已登录微信并进入好友聊天界面，账户余额充足">
</node>
<node TEXT="测试步骤：点击“红包”按钮,输入金额，不填写祝福语,点击发送">
</node>
<node TEXT="预期结果：红包发送成功并在聊天窗口显示，无祝福语或显示默认祝福语">
</node>
<node TEXT="验证点：红包正常发送">
</node>
<node TEXT="验证点：祝福语部分默认或为空">
</node>
</node>
</node>
<node TEXT="发送红包">
<node TEXT="TC-023 正常发出单人红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信，账户余额充足">
</node>
<node TEXT="测试步骤：进入好友聊天窗口,点击红包图标,输入红包金额,点击‘塞钱进红包’,输入支付密码完成支付">
</node>
<node TEXT="预期结果：红包发放成功，聊天窗口出现已发出的红包">
</node>
<node TEXT="验证点：红包显示在聊天窗口">
</node>
<node TEXT="验证点：红包金额正确">
</node>
<node TEXT="验证点：点击可查看红包详情">
</node>
</node>
<node TEXT="TC-024 余额不足时发送红包提示错误">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户账户余额低于红包金额">
</node>
<node TEXT="测试步骤：进入好友聊天窗口,点击红包图标,输入超出余额的红包金额,点击‘塞钱进红包’">
</node>
<node TEXT="预期结果：提示余额不足，红包未发送">
</node>
<node TEXT="验证点：页面提示余额不足">
</node>
<node TEXT="验证点：红包未发出">
</node>
<node TEXT="验证点：账户余额无变化">
</node>
</node>
<node TEXT="TC-025 红包金额低于下限时提示错误">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信，余额足够">
</node>
<node TEXT="测试步骤：进入好友聊天窗口,点击红包图标,输入低于平台允许下限的金额（如0.01元以下）,点击‘塞钱进红包’">
</node>
<node TEXT="预期结果：提示金额不合法，红包未发送">
</node>
<node TEXT="验证点：金额下方出现错误提示">
</node>
<node TEXT="验证点：红包未发出">
</node>
</node>
<node TEXT="TC-026 超出红包金额上限提示错误">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信，账户余额充足">
</node>
<node TEXT="测试步骤：进入好友聊天窗口,点击红包图标,输入超过平台上限金额（如大于200元）,点击‘塞钱进红包’">
</node>
<node TEXT="预期结果：提示超出金额上限，红包未发送">
</node>
<node TEXT="验证点：金额下方出现超出金额上限提示">
</node>
<node TEXT="验证点：红包未发出">
</node>
</node>
<node TEXT="TC-039 支付密码错误导致红包发送失败">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信，余额足够，准备发红包">
</node>
<node TEXT="测试步骤：进入好友聊天窗口,点击红包图标,输入有效金额,点击‘塞钱进红包’,输入错误的支付密码">
</node>
<node TEXT="预期结果：系统提示支付密码错误，红包未发出">
</node>
<node TEXT="验证点：页面出现‘密码错误’提示">
</node>
<node TEXT="验证点：未扣除账户余额">
</node>
<node TEXT="验证点：红包未出现在聊天窗口">
</node>
</node>
</node>
<node TEXT="领取个人红包">
<node TEXT="TC-006 正常领取一个未过期的个人红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户收到好友发送的红包">
</node>
<node TEXT="测试步骤：点击聊天窗口中的红包,点击“拆红包”按钮">
</node>
<node TEXT="预期结果：红包金额被领取，金额存入零钱">
</node>
<node TEXT="验证点：展示领取成功页">
</node>
<node TEXT="验证点：金额到账">
</node>
</node>
<node TEXT="TC-007 领取已被其他人领取过的个人红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：红包已被领取完">
</node>
<node TEXT="测试步骤：点击聊天窗口中的红包,点击“拆红包”按钮">
</node>
<node TEXT="预期结果：提示红包已被领取，无法再次领取">
</node>
<node TEXT="验证点：红包状态为已领取">
</node>
<node TEXT="验证点：无金额到账">
</node>
</node>
<node TEXT="TC-008 领取已过期的个人红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：红包已超过有效期">
</node>
<node TEXT="测试步骤：点击聊天窗口中的红包,点击“拆红包”按钮">
</node>
<node TEXT="预期结果：系统提示红包已过期，不允许领取">
</node>
<node TEXT="验证点：红包过期提示显示">
</node>
<node TEXT="验证点：无金额到账">
</node>
</node>
<node TEXT="TC-009 同一用户重复领取同一红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：红包未过期且该用户已领取过">
</node>
<node TEXT="测试步骤：再次点击红包,点击“拆红包”，重复领取">
</node>
<node TEXT="预期结果：系统提示不可重复领取">
</node>
<node TEXT="验证点：重复领取提示">
</node>
<node TEXT="验证点：无金额到账">
</node>
</node>
</node>
<node TEXT="领取红包">
<node TEXT="TC-027 正常领取单人红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：收件用户已登录微信，对方已发送红包，红包未被领取">
</node>
<node TEXT="测试步骤：进入聊天窗口,点击红包消息,点击‘开’按钮">
</node>
<node TEXT="预期结果：红包领取成功，余额增加相应金额">
</node>
<node TEXT="验证点：红包页面出现领取金额">
</node>
<node TEXT="验证点：账户余额增加">
</node>
<node TEXT="验证点：红包状态为已领取">
</node>
</node>
<node TEXT="TC-028 重复领取已被领取的红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：红包已被自己或他人领取完毕">
</node>
<node TEXT="测试步骤：进入聊天窗口,点击红包消息,尝试再次领取">
</node>
<node TEXT="预期结果：页面提示红包已被领取，无法再次领取">
</node>
<node TEXT="验证点：红包详情页提示‘红包已被领取’">
</node>
<node TEXT="验证点：无法重复领取">
</node>
</node>
<node TEXT="TC-029 过期红包领取提示">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：红包已过期，用户未领取">
</node>
<node TEXT="测试步骤：进入聊天窗口,点击红包消息,尝试领取">
</node>
<node TEXT="预期结果：提示红包已过期，无法领取">
</node>
<node TEXT="验证点：红包页面出现‘红包已过期’提示">
</node>
<node TEXT="验证点：余额未变化">
</node>
</node>
<node TEXT="TC-041 非收件人尝试领取个人红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：A向B发红包，C在对话中">
</node>
<node TEXT="测试步骤：C进入A与B的聊天窗口,点击红包,尝试领取">
</node>
<node TEXT="预期结果：提示您不是收件人，无法领取此红包">
</node>
<node TEXT="验证点：页面显示‘不是收件人无法领取’">
</node>
<node TEXT="验证点：红包金额未变动">
</node>
</node>
</node>
</node>
<node TEXT="红包安全">
<node TEXT="异常拦截">
<node TEXT="TC-021 红包发送过程中网络异常">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已进入红包发送页面">
</node>
<node TEXT="测试步骤：在点击发送红包时关闭网络连接,点击发送">
</node>
<node TEXT="预期结果：系统提示发送失败，无红包记录生成">
</node>
<node TEXT="验证点：显示网络异常提示">
</node>
<node TEXT="验证点：红包未发送">
</node>
<node TEXT="验证点：无红包记录">
</node>
</node>
</node>
<node TEXT="余额校验">
<node TEXT="TC-022 余额在红包发送过程中被其他地方消耗导致发送失败">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户刚进入红包发送页时余额充足，随后在其他操作中消耗余额">
</node>
<node TEXT="测试步骤：在等待页消费掉余额，使余额小于红包金额,回到红包发送页依然点击发送,系统进行余额校验">
</node>
<node TEXT="预期结果：余额不足，发送失败，提示余额不足">
</node>
<node TEXT="验证点：余额校验准确">
</node>
<node TEXT="验证点：余额不足提示">
</node>
</node>
</node>
</node>
<node TEXT="红包记录">
<node TEXT="红包记录查询">
<node TEXT="TC-017 查询个人红包发送记录">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已发送过个人红包">
</node>
<node TEXT="测试步骤：进入钱包,点击红包记录,查看已发送红包列表">
</node>
<node TEXT="预期结果：显示全部已发送的个人红包">
</node>
<node TEXT="验证点：显示红包发送时间">
</node>
<node TEXT="验证点：金额、对象、状态（已领取/未领取）正确">
</node>
</node>
<node TEXT="TC-018 查询已领取红包的到账明细">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已成功领取一个红包">
</node>
<node TEXT="测试步骤：进入红包记录,点击已领取的红包明细">
</node>
<node TEXT="预期结果：展示红包到账时间及金额">
</node>
<node TEXT="验证点：到账时间显示正确">
</node>
<node TEXT="验证点：金额和红包来源一致">
</node>
</node>
<node TEXT="TC-019 查询拼手气群红包领取详情">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户参与领取过拼手气群红包">
</node>
<node TEXT="测试步骤：进入红包记录,点击相关群红包记录,查看领取详情">
</node>
<node TEXT="预期结果：展示所有领取者名单及各自所获金额">
</node>
<node TEXT="验证点：显示群成员名单">
</node>
<node TEXT="验证点：金额分配正确">
</node>
</node>
</node>
</node>
<node TEXT="红包通知">
<node TEXT="未读红包提醒">
<node TEXT="TC-020 有未领取的红包时展示未读提示">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户有未拆开的红包消息">
</node>
<node TEXT="测试步骤：进入聊天界面,查看红包消息栏">
</node>
<node TEXT="预期结果：未领取红包消息显示特殊标识">
</node>
<node TEXT="验证点：未拆红包显示红点标识">
</node>
<node TEXT="验证点：点击后标识消失">
</node>
</node>
</node>
</node>
<node TEXT="红包详情">
<node TEXT="红包详情展示">
<node TEXT="TC-037 查看个人红包领取详情页">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：已发送并领取个人红包">
</node>
<node TEXT="测试步骤：在聊天记录中点击红包,红包领取后查看详情">
</node>
<node TEXT="预期结果：显示红包金额、领取人、状态等详情信息">
</node>
<node TEXT="验证点：展示红包金额">
</node>
<node TEXT="验证点：显示领取人昵称">
</node>
<node TEXT="验证点：显示红包领取状态">
</node>
</node>
<node TEXT="TC-038 查看群红包领取详情页">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：群红包已发送，部分成员已领取">
</node>
<node TEXT="测试步骤：在群聊中点击红包,进入详情页面">
</node>
<node TEXT="预期结果：显示已领/未领取成员、金额分配等信息">
</node>
<node TEXT="验证点：按成员展示领取金额">
</node>
<node TEXT="验证点：显示未领取成员列表">
</node>
<node TEXT="验证点：页面包含红包总金额与领取进度">
</node>
</node>
</node>
</node>
<node TEXT="群红包">
<node TEXT="发送群红包">
<node TEXT="TC-010 发送等额普通群红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信并进入群聊页面，余额充足">
</node>
<node TEXT="测试步骤：在群聊聊天界面点击“+”按钮,选择“红包”功能,选择“普通红包”，输入金额和个数，点击发送">
</node>
<node TEXT="预期结果：普通红包发送成功，红包在群聊中显示">
</node>
<node TEXT="验证点：显示红包条目">
</node>
<node TEXT="验证点：金额与个数对应">
</node>
</node>
<node TEXT="TC-011 发送随机金额的拼手气群红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信并进入群聊页面，余额充足">
</node>
<node TEXT="测试步骤：在群聊聊天界面点击“+”按钮,选择“红包”功能,选择“拼手气红包”，输入总金额和个数，点击发送">
</node>
<node TEXT="预期结果：拼手气红包发送成功，红包在群聊中显示">
</node>
<node TEXT="验证点：红包显示为“拼手气红包”">
</node>
<node TEXT="验证点：金额正确">
</node>
</node>
<node TEXT="TC-014 发送群红包数量大于群成员数（异常场景）">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群成员数量小于输入红包份数">
</node>
<node TEXT="测试步骤：进入群红包发送界面,输入红包份数大于实际群成员数量,点击发送">
</node>
<node TEXT="预期结果：系统提示红包份数不能大于群成员人数，红包发送失败">
</node>
<node TEXT="验证点：份数数量校验提示">
</node>
<node TEXT="验证点：红包未发送">
</node>
</node>
<node TEXT="TC-015 发送最低金额拼手气红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已登录微信并进入群聊页面，余额充足">
</node>
<node TEXT="测试步骤：选择“拼手气红包”,输入总金额为允许最小金额，设置合适份数,发送红包">
</node>
<node TEXT="预期结果：拼手气红包发送成功，金额为最小允许值">
</node>
<node TEXT="验证点：红包发送成功">
</node>
<node TEXT="验证点：金额为最小值">
</node>
</node>
<node TEXT="TC-030 正常发送拼手气群红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信，账户余额充足">
</node>
<node TEXT="测试步骤：进入群聊窗口,点击红包图标,选择‘拼手气红包’,填写红包总金额和个数,点击‘塞钱进红包’,输入支付密码">
</node>
<node TEXT="预期结果：群红包成功发送至群聊">
</node>
<node TEXT="验证点：红包显示在群聊窗口">
</node>
<node TEXT="验证点：红包类型为拼手气">
</node>
<node TEXT="验证点：金额和人数正确">
</node>
</node>
<node TEXT="TC-031 群红包成员数大于红包数提示错误">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群成员数小于红包个数">
</node>
<node TEXT="测试步骤：进入群聊窗口,选择红包图标,选择‘拼手气红包’,填写红包个数超过当前群成员数,点击‘塞钱进红包’">
</node>
<node TEXT="预期结果：提示红包个数不能大于群成员数">
</node>
<node TEXT="验证点：页面出现红色提示">
</node>
<node TEXT="验证点：红包未发出">
</node>
</node>
<node TEXT="TC-032 群红包金额低于下限提示错误">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信，余额足够">
</node>
<node TEXT="测试步骤：进入群聊窗口,点击红包图标,选择‘普通红包’,填写红包金额低于系统下限,填写个数,点击‘塞钱进红包’">
</node>
<node TEXT="预期结果：提示红包金额错误">
</node>
<node TEXT="验证点：金额下方出现错误提示">
</node>
<node TEXT="验证点：红包未发出">
</node>
</node>
<node TEXT="TC-040 发送普通群红包（平均分配）">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信，余额充足，有入群权限">
</node>
<node TEXT="测试步骤：进入群聊窗口,点击红包图标,选择‘普通红包’,填写总金额和个数,点击‘塞钱进红包’,输入支付密码">
</node>
<node TEXT="预期结果：普通群红包成功发送到群聊">
</node>
<node TEXT="验证点：红包为‘普通红包’类型">
</node>
<node TEXT="验证点：金额按成员均分">
</node>
</node>
</node>
<node TEXT="领取群红包">
<node TEXT="TC-012 群成员领取拼手气红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：群聊有可领取的拼手气红包">
</node>
<node TEXT="测试步骤：点击红包,点击“拆红包”领取,查看领取金额">
</node>
<node TEXT="预期结果：红包领取成功，界面显示获得的随机金额">
</node>
<node TEXT="验证点：领取金额为随机">
</node>
<node TEXT="验证点：金额到账">
</node>
</node>
<node TEXT="TC-013 群红包已被领完时再次领取">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：所有份额已被其他成员领取">
</node>
<node TEXT="测试步骤：点击红包,点击“拆红包”尝试领取">
</node>
<node TEXT="预期结果：系统提示已被领完">
</node>
<node TEXT="验证点：已被领完提示">
</node>
<node TEXT="验证点：无金额到账">
</node>
</node>
<node TEXT="TC-016 领取已过期的群红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群红包过期后未被领取">
</node>
<node TEXT="测试步骤：点击红包,尝试拆开红包">
</node>
<node TEXT="预期结果：提示红包已过期，不允许领取">
</node>
<node TEXT="验证点：红包过期提示">
</node>
<node TEXT="验证点：无金额到账">
</node>
</node>
<node TEXT="TC-033 正常领取拼手气群红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：群中有未领取的拼手气红包，用户未领取过">
</node>
<node TEXT="测试步骤：进入群聊窗口,点击拼手气红包,点击‘开’按钮">
</node>
<node TEXT="预期结果：显示领取金额，账户余额增加相应额度">
</node>
<node TEXT="验证点：页面显示随机领取金额">
</node>
<node TEXT="验证点：余额增加">
</node>
<node TEXT="验证点：红包状态更新为已领取">
</node>
</node>
<node TEXT="TC-034 重复领取群红包提示已领取">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已领取该红包">
</node>
<node TEXT="测试步骤：进入群聊窗口,点击拼手气红包,点击‘开’按钮">
</node>
<node TEXT="预期结果：提示已领取，无法再次领取">
</node>
<node TEXT="验证点：页面显示‘已领取’">
</node>
<node TEXT="验证点：领取按钮不可用">
</node>
</node>
<node TEXT="TC-035 群红包被领完后剩余用户领取提示已领完">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群红包已被全部成员领取完毕，当前用户未领取">
</node>
<node TEXT="测试步骤：进入群聊窗口,点击已被领完的红包,点击‘开’按钮">
</node>
<node TEXT="预期结果：提示红包已领完，无法领取">
</node>
<node TEXT="验证点：页面显示‘红包已领完’提示">
</node>
<node TEXT="验证点：无法领取金额">
</node>
</node>
<node TEXT="TC-036 群红包过期后无法领取">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群红包已过期，未全部领取">
</node>
<node TEXT="测试步骤：进入群聊窗口,点击过期红包,点击‘开’按钮">
</node>
<node TEXT="预期结果：提示红包已过期，无法领取">
</node>
<node TEXT="验证点：页面显示‘红包已过期’">
</node>
<node TEXT="验证点：余额未变化">
</node>
</node>
<node TEXT="TC-042 非群成员尝试领取群红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：群红包已发，用户已不在该群">
</node>
<node TEXT="测试步骤：用户退出群聊,点击以往群红包链接,尝试领取">
</node>
<node TEXT="预期结果：无法领取红包，并出现权限提示">
</node>
<node TEXT="验证点：提示‘非群成员无法领取’">
</node>
<node TEXT="验证点：红包未被领取">
</node>
</node>
</node>
</node>
</node>
</map>