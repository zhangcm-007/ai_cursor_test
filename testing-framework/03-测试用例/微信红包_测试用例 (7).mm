<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="微信红包">
<node TEXT="微信红包">
<node TEXT="拼手气红包">
<node TEXT="TC-006 拼手气红包金额分配正确">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已输入10元，5个红包；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用lucky_red_packet接口，参数total_amount=10, num=5">
</node>
<node TEXT="预期结果：返回5个金额，每个金额不低于0.01元，总和等于10元">
</node>
<node TEXT="验证点：返回金额列表长度为5">
</node>
<node TEXT="验证点：每个金额大于等于0.01元">
</node>
<node TEXT="验证点：金额分布随机">
</node>
<node TEXT="验证点：总金额等于10.00元">
</node>
</node>
<node TEXT="TC-007 拼手气红包金额不足导致校验异常">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已输入0.02元，3个红包；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用lucky_red_packet接口，参数total_amount=0.02, num=3">
</node>
<node TEXT="预期结果：抛出异常，提示总金额至少为0.03元">
</node>
<node TEXT="验证点：捕获ValueError异常">
</node>
<node TEXT="验证点：异常信息包含“总金额至少为 0.03 元”">
</node>
</node>
<node TEXT="TC-008 拼手气红包红包个数为零异常处理">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已输入10元，红包个数为0；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用lucky_red_packet接口，参数total_amount=10, num=0">
</node>
<node TEXT="预期结果：抛出异常，提示红包个数必须大于0">
</node>
<node TEXT="验证点：捕获ValueError异常">
</node>
<node TEXT="验证点：异常信息包含“红包个数必须大于0”">
</node>
</node>
<node TEXT="TC-009 拼手气红包单个红包金额超限">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已输入201元，1个红包；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用lucky_red_packet接口，参数total_amount=201, num=1">
</node>
<node TEXT="预期结果：抛出异常，提示单个红包总金额不能超过200元">
</node>
<node TEXT="验证点：捕获ValueError异常">
</node>
<node TEXT="验证点：异常信息包含“单个红包总金额不能超过 200 元”">
</node>
</node>
<node TEXT="TC-010 拼手气红包边界测试，每个红包金额为最低值">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已输入0.03元，3个红包；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用lucky_red_packet接口，参数total_amount=0.03, num=3">
</node>
<node TEXT="预期结果：返回3个金额，每个都为0.01元，总和为0.03元">
</node>
<node TEXT="验证点：返回金额列表长度为3">
</node>
<node TEXT="验证点：每个金额等于0.01元">
</node>
<node TEXT="验证点：总金额等于0.03元">
</node>
</node>
<node TEXT="TC-011 拼手气红包大批量分配测试">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已输入200元，200个红包；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用lucky_red_packet接口，参数total_amount=200, num=200">
</node>
<node TEXT="预期结果：返回200个红包，每个大于等于0.01元">
</node>
<node TEXT="验证点：返回金额列表长度为200">
</node>
<node TEXT="验证点：每个金额大于等于0.01元">
</node>
<node TEXT="验证点：总金额等于200.00元">
</node>
</node>
<node TEXT="TC-012 拼手气红包金额为字符串类型">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已输入金额为&apos;10.01&apos;字符串，5个红包；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用lucky_red_packet接口，参数total_amount=&apos;10.01&apos;, num=5">
</node>
<node TEXT="预期结果：返回5个随机金额，金额总和为10.01元，金额类型正确">
</node>
<node TEXT="验证点：返回金额列表长度为5">
</node>
<node TEXT="验证点：金额类型为Decimal或浮点数">
</node>
<node TEXT="验证点：金额分布合理">
</node>
<node TEXT="验证点：总金额等于10.01元">
</node>
</node>
<node TEXT="TC-017 拼手气红包红包个数输入为负数异常处理">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已输入10元，红包个数为-5；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用lucky_red_packet接口，参数total_amount=10, num=-5">
</node>
<node TEXT="预期结果：抛出异常，提示红包个数必须大于0">
</node>
<node TEXT="验证点：捕获ValueError异常">
</node>
<node TEXT="验证点：异常信息包含“红包个数必须大于0”">
</node>
</node>
<node TEXT="TC-019 拼手气红包金额为负数异常处理">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已输入金额为-10，红包个数为5；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用lucky_red_packet接口，参数total_amount=-10, num=5">
</node>
<node TEXT="预期结果：抛出异常，提示总金额至少为0.05元">
</node>
<node TEXT="验证点：捕获ValueError异常">
</node>
<node TEXT="验证点：异常信息包含“总金额至少为 0.05 元”">
</node>
</node>
</node>
<node TEXT="普通红包">
<node TEXT="TC-001 普通红包分配金额正确">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已输入10元，5个红包；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用normal_red_packet接口，参数total_amount=10, num=5">
</node>
<node TEXT="预期结果：返回5个金额相等的红包，每个金额为2.00元">
</node>
<node TEXT="验证点：每个红包金额等于2.00元">
</node>
<node TEXT="验证点：总金额等于10.00元">
</node>
<node TEXT="验证点：返回金额列表长度为5">
</node>
</node>
<node TEXT="TC-002 普通红包分配金额包含零头情况">
<node TEXT="优先级：P1">
</node>
<node TEXT="前置条件：用户已输入10.01元，5个红包；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用normal_red_packet接口，参数total_amount=10.01, num=5">
</node>
<node TEXT="预期结果：返回5个金额，大部分为2.00元，部分为2.01元">
</node>
<node TEXT="验证点：返回金额列表长度为5">
</node>
<node TEXT="验证点：金额分布中零头合理分配，部分为2.01元">
</node>
<node TEXT="验证点：总金额等于10.01元">
</node>
</node>
<node TEXT="TC-003 普通红包金额不足导致参数校验失败">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已输入0.02元，3个红包；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用normal_red_packet接口，参数total_amount=0.02, num=3">
</node>
<node TEXT="预期结果：抛出参数校验异常，提示总金额至少为0.03元">
</node>
<node TEXT="验证点：捕获ValueError异常">
</node>
<node TEXT="验证点：异常信息包含“总金额至少为 0.03 元”">
</node>
</node>
<node TEXT="TC-004 普通红包单个红包金额超限">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已输入201元，1个红包；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用normal_red_packet接口，参数total_amount=201, num=1">
</node>
<node TEXT="预期结果：抛出异常，提示单个红包总金额不能超过200元">
</node>
<node TEXT="验证点：捕获ValueError异常">
</node>
<node TEXT="验证点：异常信息包含“单个红包总金额不能超过 200 元”">
</node>
</node>
<node TEXT="TC-005 普通红包红包个数为零异常处理">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已输入10元，红包个数为0；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用normal_red_packet接口，参数total_amount=10, num=0">
</node>
<node TEXT="预期结果：抛出异常，提示红包个数必须大于0">
</node>
<node TEXT="验证点：捕获ValueError异常">
</node>
<node TEXT="验证点：异常信息包含“红包个数必须大于0”">
</node>
</node>
<node TEXT="TC-013 普通红包金额为字符串类型">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已输入金额为&apos;10.01&apos;字符串，5个红包；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用normal_red_packet接口，参数total_amount=&apos;10.01&apos;, num=5">
</node>
<node TEXT="预期结果：返回5个金额，大部分为2.00元，部分为2.01元，金额类型正确">
</node>
<node TEXT="验证点：返回金额列表长度为5">
</node>
<node TEXT="验证点：金额类型为Decimal或浮点数">
</node>
<node TEXT="验证点：金额分布中零头合理分配">
</node>
<node TEXT="验证点：总金额等于10.01元">
</node>
</node>
<node TEXT="TC-014 普通红包边界测试，每个红包金额为最低值">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已输入0.03元，3个红包；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用normal_red_packet接口，参数total_amount=0.03, num=3">
</node>
<node TEXT="预期结果：返回3个红包，每个金额为0.01元">
</node>
<node TEXT="验证点：返回金额列表长度为3">
</node>
<node TEXT="验证点：每个金额等于0.01元">
</node>
<node TEXT="验证点：总金额等于0.03元">
</node>
</node>
<node TEXT="TC-015 普通红包红包个数大批量测试">
<node TEXT="优先级：P2">
</node>
<node TEXT="前置条件：用户已输入200元，200个红包；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用normal_red_packet接口，参数total_amount=200, num=200">
</node>
<node TEXT="预期结果：返回200个红包，每个金额为1.00元">
</node>
<node TEXT="验证点：返回金额列表长度为200">
</node>
<node TEXT="验证点：每个金额等于1.00元">
</node>
<node TEXT="验证点：总金额等于200.00元">
</node>
</node>
<node TEXT="TC-016 普通红包红包个数输入为负数异常处理">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已输入10元，红包个数为-5；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用normal_red_packet接口，参数total_amount=10, num=-5">
</node>
<node TEXT="预期结果：抛出异常，提示红包个数必须大于0">
</node>
<node TEXT="验证点：捕获ValueError异常">
</node>
<node TEXT="验证点：异常信息包含“红包个数必须大于0”">
</node>
</node>
<node TEXT="TC-018 普通红包金额为负数异常处理">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：用户已输入金额为-10，红包个数为5；系统正常运行">
</node>
<node TEXT="测试步骤：1. 调用normal_red_packet接口，参数total_amount=-10, num=5">
</node>
<node TEXT="预期结果：抛出异常，提示总金额至少为0.05元">
</node>
<node TEXT="验证点：捕获ValueError异常">
</node>
<node TEXT="验证点：异常信息包含“总金额至少为 0.05 元”">
</node>
</node>
</node>
</node>
</node>
</map>