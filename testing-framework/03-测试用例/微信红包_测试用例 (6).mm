<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="微信红包">
<node TEXT="个人红包">
<node TEXT="发送红包">
<node TEXT="TC-001 发送金额为100元的个人红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信且账号绑定银行卡，余额充足。">
</node>
<node TEXT="测试步骤：1. 打开微信主界面,2. 进入联系人聊天窗口,3. 点击红包按钮,4. 输入红包金额100元,5. 输入祝福语,6. 确认发送">
</node>
<node TEXT="预期结果：红包成功发送，聊天窗口显示红包消息。">
</node>
<node TEXT="验证点：红包已生成且消息正常显示">
</node>
<node TEXT="验证点：红色红包图标展示">
</node>
<node TEXT="验证点：金额和祝福语正确">
</node>
</node>
<node TEXT="TC-002 发送金额超过余额的个人红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信，余额不足。">
</node>
<node TEXT="测试步骤：1. 打开微信主界面,2. 进入联系人聊天窗口,3. 点击红包按钮,4. 输入红包金额大于余额,5. 输入祝福语,6. 点击确认发送">
</node>
<node TEXT="预期结果：发送失败，提示余额不足。">
</node>
<node TEXT="验证点：发送按钮不可用或提示弹窗【余额不足】">
</node>
<node TEXT="验证点：红包未生成">
</node>
</node>
<node TEXT="TC-003 发送金额为0元的个人红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已登录微信。">
</node>
<node TEXT="测试步骤：1. 打开微信主界面,2. 进入联系人聊天窗口,3. 点击红包按钮,4. 输入红包金额0元,5. 点击确认发送">
</node>
<node TEXT="预期结果：无法发送，金额校验提示。">
</node>
<node TEXT="验证点：金额输入框下方出现【金额不能为0元】提示">
</node>
<node TEXT="验证点：发送按钮不可用或无响应">
</node>
</node>
<node TEXT="TC-004 祝福语为空时发送个人红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已登录微信，余额充足。">
</node>
<node TEXT="测试步骤：1. 打开微信主界面,2. 进入联系人聊天窗口,3. 点击红包按钮,4. 输入红包金额,5. 祝福语留空,6. 确认发送">
</node>
<node TEXT="预期结果：红包成功发送，祝福语自动补全为默认内容。">
</node>
<node TEXT="验证点：红包消息展示正常">
</node>
<node TEXT="验证点：祝福语显示为系统默认文案">
</node>
</node>
<node TEXT="TC-005 遇到网络超时时发送个人红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已登录微信，网络环境不稳定。">
</node>
<node TEXT="测试步骤：1. 打开微信主界面,2. 进入联系人聊天窗口,3. 点击红包按钮,4. 输入金额及祝福语,5. 断开网络,6. 点击确认发送">
</node>
<node TEXT="预期结果：红包未发送成功，提示网络异常。">
</node>
<node TEXT="验证点：提示【网络连接异常，请重试】">
</node>
<node TEXT="验证点：红包未发送">
</node>
<node TEXT="验证点：发送按钮可重新点击">
</node>
</node>
<node TEXT="TC-006 服务器错误时发送个人红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信，正常网络。">
</node>
<node TEXT="测试步骤：1. 打开微信主界面,2. 进入聊天窗口,3. 点击红包按钮,4. 输入金额及祝福语,5. 模拟服务器返回错误,6. 点击确认发送">
</node>
<node TEXT="预期结果：红包发送失败，提示服务器异常。">
</node>
<node TEXT="验证点：提示【服务器异常，请稍后】">
</node>
</node>
<node TEXT="TC-007 无银行卡绑定时发送个人红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信，未绑定银行卡。">
</node>
<node TEXT="测试步骤：1. 打开微信主界面,2. 进入聊天窗口,3. 点击红包按钮,4. 输入金额及祝福语,5. 点击确认发送">
</node>
<node TEXT="预期结果：无法发送，弹窗提示绑定银行卡。">
</node>
<node TEXT="验证点：弹窗提示【需绑定银行卡】">
</node>
<node TEXT="验证点：红包未生成">
</node>
</node>
</node>
<node TEXT="红包领取">
<node TEXT="TC-008 正常领取个人红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户收到个人红包消息。">
</node>
<node TEXT="测试步骤：1. 打开聊天窗口,2. 点击红包消息,3. 点击【拆开红包】按钮">
</node>
<node TEXT="预期结果：红包领取成功，界面显示领取金额和祝福语。">
</node>
<node TEXT="验证点：领取金额显示正确">
</node>
<node TEXT="验证点：祝福语展示">
</node>
<node TEXT="验证点：红包状态更新为【已领取】">
</node>
</node>
<node TEXT="TC-009 领取已过期个人红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户收到已过期个人红包消息。">
</node>
<node TEXT="测试步骤：1. 打开聊天窗口,2. 点击红包消息,3. 点击【拆开红包】按钮">
</node>
<node TEXT="预期结果：无法领取，界面提示红包已过期。">
</node>
<node TEXT="验证点：提示【红包已过期】">
</node>
<node TEXT="验证点：金额不展示">
</node>
</node>
<node TEXT="TC-010 重复领取个人红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：红包已被领取。">
</node>
<node TEXT="测试步骤：1. 打开聊天窗口,2. 点击已领取红包消息,3. 点击【拆开红包】按钮">
</node>
<node TEXT="预期结果：无法重复领取，提示红包已被领取。">
</node>
<node TEXT="验证点：提示【已领取】">
</node>
<node TEXT="验证点：金额不重复增加">
</node>
</node>
<node TEXT="TC-011 网络异常时领取个人红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户收到个人红包消息，网络不稳定。">
</node>
<node TEXT="测试步骤：1. 打开聊天窗口,2. 断开网络,3. 点击红包消息,4. 点击【拆开红包】按钮">
</node>
<node TEXT="预期结果：领取失败，显示网络异常提示。">
</node>
<node TEXT="验证点：提示【网络异常，请重试】">
</node>
</node>
<node TEXT="TC-012 领取个人红包时服务器错误">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户收到个人红包消息，服务器异常。">
</node>
<node TEXT="测试步骤：1. 打开聊天窗口,2. 点击红包消息,3. 模拟服务器异常,4. 点击【拆开红包】按钮">
</node>
<node TEXT="预期结果：领取失败，提示服务器异常。">
</node>
<node TEXT="验证点：提示【服务器异常，请稍后再试】">
</node>
</node>
<node TEXT="TC-013 无权限用户尝试领取个人红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户未通过实名认证。">
</node>
<node TEXT="测试步骤：1. 打开聊天窗口,2. 点击红包消息,3. 点击【拆开红包】按钮">
</node>
<node TEXT="预期结果：领取失败，提示无权限。">
</node>
<node TEXT="验证点：显示【未实名认证，无法领取红包】">
</node>
</node>
</node>
</node>
<node TEXT="群红包">
<node TEXT="发送群红包">
<node TEXT="TC-014 发送群红包（指定人数、随机金额）">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信，余额充足，加入群聊。">
</node>
<node TEXT="测试步骤：1. 打开群聊窗口,2. 点击红包按钮,3. 选择【拼手气红包】,4. 输入总金额与人数,5. 输入祝福语,6. 点击确认发送">
</node>
<node TEXT="预期结果：群红包发送成功，群聊显示红包消息。">
</node>
<node TEXT="验证点：拼手气红包标识">
</node>
<node TEXT="验证点：总金额和人数正确">
</node>
<node TEXT="验证点：显示祝福语">
</node>
</node>
<node TEXT="TC-015 发送定额群红包（每人固定金额）">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信，余额充足，进入群聊。">
</node>
<node TEXT="测试步骤：1. 打开群聊窗口,2. 点击红包按钮,3. 选择【普通红包】,4. 输入每人定额与人数,5. 输入祝福语,6. 点击确认发送">
</node>
<node TEXT="预期结果：普通群红包发送成功，金额按定额分配。">
</node>
<node TEXT="验证点：普通红包标识">
</node>
<node TEXT="验证点：人数及金额总和正确">
</node>
<node TEXT="验证点：祝福语显示">
</node>
</node>
<node TEXT="TC-016 发送金额为0元的群红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已登录微信，加入群聊。">
</node>
<node TEXT="测试步骤：1. 打开群聊窗口,2. 点击红包按钮,3. 选择红类型,4. 输入金额0元及人数,5. 点击确定">
</node>
<node TEXT="预期结果：无法发送，金额校验提示。">
</node>
<node TEXT="验证点：金额输入框下方提示【金额不能为0元】">
</node>
<node TEXT="验证点：发送按钮不可用">
</node>
</node>
<node TEXT="TC-017 发送人数大于群人数的群红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已登录微信，群人数为10人。">
</node>
<node TEXT="测试步骤：1. 打开群聊窗口,2. 点击红包按钮,3. 输入总金额及人数为11人,4. 确认发送">
</node>
<node TEXT="预期结果：发送失败，提示人数错误。">
</node>
<node TEXT="验证点：提示【红包人数不能大于群人数】">
</node>
</node>
<node TEXT="TC-018 发送群红包时网络超时">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已登录微信，网络不稳定。">
</node>
<node TEXT="测试步骤：1. 打开群聊窗口,2. 点击红包按钮,3. 输入金额及人数,4. 断开网络,5. 点击确认发送">
</node>
<node TEXT="预期结果：无法发送，提示网络异常。">
</node>
<node TEXT="验证点：提示【网络连接异常】">
</node>
<node TEXT="验证点：红包未生成">
</node>
</node>
<node TEXT="TC-019 服务器错误时发送群红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信，正常网络。">
</node>
<node TEXT="测试步骤：1. 打开群聊窗口,2. 点击红包按钮,3. 输入金额及人数,4. 模拟服务器异常,5. 点击确认发送">
</node>
<node TEXT="预期结果：发送失败，提示服务器异常。">
</node>
<node TEXT="验证点：提示【服务器异常，请稍后再试】">
</node>
</node>
</node>
<node TEXT="红包领取">
<node TEXT="TC-020 正常领取群红包">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户在群聊收到群红包消息。">
</node>
<node TEXT="测试步骤：1. 打开群聊窗口,2. 点击红包消息,3. 点击【拆开红包】按钮">
</node>
<node TEXT="预期结果：领取成功，显示领取金额及祝福语。">
</node>
<node TEXT="验证点：领取金额显示正确">
</node>
<node TEXT="验证点：祝福语展示">
</node>
<node TEXT="验证点：红包消息状态更新">
</node>
</node>
<node TEXT="TC-021 领取已被抢完的群红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群红包已被抢完。">
</node>
<node TEXT="测试步骤：1. 打开群聊窗口,2. 点击红包消息,3. 点击【拆开红包】按钮">
</node>
<node TEXT="预期结果：领取失败，提示红包已抢完。">
</node>
<node TEXT="验证点：提示【红包已被抢完】">
</node>
<node TEXT="验证点：金额不展示">
</node>
</node>
<node TEXT="TC-022 领取过期群红包">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群红包已过领取有效期。">
</node>
<node TEXT="测试步骤：1. 打开群聊窗口,2. 点击红包消息,3. 点击【拆开红包】按钮">
</node>
<node TEXT="预期结果：领取失败，提示过期信息。">
</node>
<node TEXT="验证点：提示【红包已过期】">
</node>
</node>
<node TEXT="TC-023 网络异常时领取群红包">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：群红包未被抢完，网络不稳定。">
</node>
<node TEXT="测试步骤：1. 打开群聊窗口,2. 断开网络,3. 点击红包消息,4. 点击【拆开红包】按钮">
</node>
<node TEXT="预期结果：领取失败，提示网络异常。">
</node>
<node TEXT="验证点：提示【网络异常，请重试】">
</node>
</node>
<node TEXT="TC-024 领取群红包时服务器错误">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：群红包未被抢完，服务器异常。">
</node>
<node TEXT="测试步骤：1. 打开群聊窗口,2. 点击红包消息,3. 模拟服务器异常,4. 点击【拆开红包】按钮">
</node>
<node TEXT="预期结果：领取失败，提示服务器异常。">
</node>
<node TEXT="验证点：提示【服务器异常，请稍后再试】">
</node>
</node>
</node>
</node>
<node TEXT="账户余额">
<node TEXT="余额查询">
<node TEXT="TC-025 红包发送后余额减少">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信，余额充足。">
</node>
<node TEXT="测试步骤：1. 发送个人/群红包,2. 进入钱包查询余额">
</node>
<node TEXT="预期结果：发现余额减少，金额等于已发送红包总金额。">
</node>
<node TEXT="验证点：余额变动与红包金额一致">
</node>
</node>
<node TEXT="TC-026 红包领取后余额增加">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已登录微信，成功领取红包。">
</node>
<node TEXT="测试步骤：1. 领取个人/群红包,2. 进入钱包查询余额">
</node>
<node TEXT="预期结果：发现余额增加，金额等于领取的红包金额。">
</node>
<node TEXT="验证点：余额变动与领取金额一致">
</node>
</node>
</node>
</node>
</node>
</map>