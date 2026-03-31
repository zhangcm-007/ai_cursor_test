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
</node>
</map>