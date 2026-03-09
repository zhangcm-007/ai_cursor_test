<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
<node TEXT="三角形判定">
<node TEXT="功能-合法三角形类型">
<node TEXT="TC-001 等边三角形判定（3,3,3）">
<node TEXT="优先级：P0">
</node>
<node TEXT="前置条件：三角形判定功能已就绪，可输入三条边">
</node>
<node TEXT="测试步骤：1. 输入边长 a=3, b=3, c=3 2. 执行判定或提交 3. 查看输出结果">
</node>
<node TEXT="预期结果：判定结果为「等边三角形」或等价表述">
</node>
</node>
<node TEXT="TC-002 等腰三角形 a=b（3,3,4）">
</node>
<node TEXT="TC-003 等腰三角形 b=c（3,4,4）">
</node>
<node TEXT="TC-004 等腰三角形 a=c（3,4,3）">
</node>
<node TEXT="TC-005 一般三角形判定（3,4,5）">
</node>
</node>
<node TEXT="功能-不构成三角形与非法输入">
<node TEXT="TC-006 两边之和小于第三边（1,2,4）">
</node>
<node TEXT="TC-007 退化三角形两边之和等于第三边（1,2,3）">
</node>
<node TEXT="TC-008 任一边长为 0（0,1,2）">
</node>
<node TEXT="TC-009 任一边长为负数（-1,2,3）">
</node>
</node>
<node TEXT="输入与数据">
<node TEXT="TC-010 输入含字母或符号">
</node>
<node TEXT="TC-011 输入为空或空字符串">
</node>
<node TEXT="TC-012 输入个数少于 3">
</node>
<node TEXT="TC-013 输入个数多于 3">
</node>
<node TEXT="TC-014 小数边长合法三角形（1.5,2.5,3.0）">
</node>
<node TEXT="TC-015 输出结果与四种类型一致">
</node>
</node>
<node TEXT="界面/易用性">
<node TEXT="TC-016 输入框数量与三条边说明清晰">
</node>
<node TEXT="TC-017 错误输入时提示明确友好">
</node>
<node TEXT="TC-018 结果展示区分等边/等腰/一般/非三角形">
</node>
</node>
<node TEXT="接口/数据">
<node TEXT="TC-019 入参类型错误或缺失时的处理">
</node>
<node TEXT="TC-020 返回码与返回文案符合约定">
</node>
</node>
</node>
</map>