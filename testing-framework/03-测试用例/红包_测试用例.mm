<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="红包">
<node TEXT="REQ-整体">
<node TEXT="TC-001 微信红包发送流程正常">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已登录微信，余额充足。">
</node>
<node TEXT="测试步骤：进入微信聊天窗口,点击“+”并选择“发红包”,输入红包金额和祝福语,确认无误点击发送">
</node>
<node TEXT="预期结果：红包发送成功，页面提示发送成功信息。">
</node>
<node TEXT="验证点：红包金额正确显示">
</node>
<node TEXT="验证点：祝福语显示正确">
</node>
<node TEXT="验证点：点击红包后跳转到详情页">
</node>
</node>
<node TEXT="TC-002 微信红包领取流程">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户收到好友发来的红包。">
</node>
<node TEXT="测试步骤：在聊天窗口点击收到的红包,进入红包打开页，点击“开”字按钮,观察领取结果">
</node>
<node TEXT="预期结果：红包领取成功，显示领取金额及领取结果页面。">
</node>
<node TEXT="验证点：领取金额显示正确">
</node>
<node TEXT="验证点：若已被领完显示已抢完状态">
</node>
<node TEXT="验证点：红包详情页可查看发放时间、领取成员名单等">
</node>
</node>
<node TEXT="TC-003 余额不足时微信红包发送失败">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户余额低于红包金额">
</node>
<node TEXT="测试步骤：进入微信红包发送界面,输入超过余额的红包金额,点击发送">
</node>
<node TEXT="预期结果：发送失败，弹窗提示余额不足。">
</node>
<node TEXT="验证点：弹窗提示余额不足">
</node>
<node TEXT="验证点：无法成功发送红包">
</node>
</node>
<node TEXT="TC-004 多人群聊-群红包发放与拆分">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户在多人微信群聊中">
</node>
<node TEXT="测试步骤：在群聊界面点击“红包”,选择“拼手气红包”,输入总金额和红包数量，点击发送,其他用户依次领取">
</node>
<node TEXT="预期结果：红包可正常被多位成员领取，各成员金额随机。">
</node>
<node TEXT="验证点：每个人领取金额不同（拼手气）">
</node>
<node TEXT="验证点：红包状态及时变更为“已领完”">
</node>
<node TEXT="验证点：红包详情页展示所有领取者名单及金额">
</node>
</node>
<node TEXT="TC-005 微信红包过期处理">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：红包发出已超24小时未被领取完">
</node>
<node TEXT="测试步骤：查看超时红包在聊天列表和红包记录中的展示状态,点击红包进入详情页">
</node>
<node TEXT="预期结果：未领取红包自动退回发起人，红包详情页显示已过期。">
</node>
<node TEXT="验证点：未领取金额退回发起人零钱账户">
</node>
<node TEXT="验证点：红包详情页有过期提示">
</node>
<node TEXT="验证点：已领取部分可正确显示">
</node>
</node>
<node TEXT="TC-006 微信红包祝福语输入校验">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户准备发送红包">
</node>
<node TEXT="测试步骤：在发红包界面输入特殊字符或超长字符到祝福语,提交红包发送">
</node>
<node TEXT="预期结果：系统校验祝福语长度及内容，非法时有提示。">
</node>
<node TEXT="验证点：祝福语长度有字数上限">
</node>
<node TEXT="验证点：包含非法字符时有友好弹窗">
</node>
</node>
</node>
</node>
</map>