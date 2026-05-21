<map version="1.0.1">
  <node TEXT="测试用例生成规范">

    <node TEXT="1. 用例字段（固定不可省略）" POSITION="right">
      <node TEXT="编号：TC-001 全局自增，跨模块连续"/>
      <node TEXT="标题：动宾结构，不超过20字"/>
      <node TEXT="测试点：必填项/边界/权限/幂等/状态流转等"/>
      <node TEXT="用例类型：功能/接口/UI/性能/兼容性"/>
      <node TEXT="前置条件：环境和数据状态"/>
      <node TEXT="步骤：1.xxx → 2.xxx"/>
      <node TEXT="预期结果：与步骤一一对应"/>
      <node TEXT="实际结果：执行后填写"/>
      <node TEXT="执行状态：Pass / Fail / Block / Skip"/>
      <node TEXT="优先级：P0 / P1 / P2 / P3"/>
    </node>

    <node TEXT="2. 覆盖维度（每需求必覆盖）" POSITION="right">
      <node TEXT="正向：主流程成功路径"/>
      <node TEXT="反向：无效输入，拒绝并正确提示"/>
      <node TEXT="必填项校验：逐字段置空、全空、仅空格"/>
      <node TEXT="边界：最大/最小/空值/临界长度"/>
      <node TEXT="异常：网络中断、超时、数据库异常"/>
      <node TEXT="并发幂等：重复提交、并发脏数据"/>
      <node TEXT="权限：角色/未登录/越权"/>
      <node TEXT="性能：仅接口测试用例关注"/>
      <node TEXT="兼容性：浏览器/系统/移动端"/>
      <node TEXT="数据隔离：多用户数据不互串"/>
      <node TEXT="回滚/撤销：失败后状态还原"/>
    </node>

    <node TEXT="3. 必填项校验规则" POSITION="right">
      <node TEXT="单字段为空：提示指向该字段"/>
      <node TEXT="全部字段为空：提示第一个必填项"/>
      <node TEXT="仅空格：识别为空"/>
      <node TEXT="提示文案明确：XXX不能为空"/>
      <node TEXT="提交拦截：前端不发请求"/>
    </node>

    <node TEXT="4. 标题规范" POSITION="right">
      <node TEXT="必须：动宾结构">
        <node TEXT="示例：提交订单"/>
        <node TEXT="示例：校验手机号格式"/>
        <node TEXT="示例：拒绝越权访问"/>
      </node>
      <node TEXT="禁止：模糊空话">
        <node TEXT="禁止：测试 xxx 功能"/>
        <node TEXT="禁止：验证 xxx"/>
      </node>
      <node TEXT="长度：不超过 20 字"/>
    </node>

    <node TEXT="5. 优先级定义" POSITION="left">
      <node TEXT="P0 冒烟">
        <node TEXT="阻塞上线"/>
        <node TEXT="必须 100% 通过"/>
        <node TEXT="任何 Fail 立即停止提测"/>
      </node>
      <node TEXT="P1 核心">
        <node TEXT="核心业务流程"/>
        <node TEXT="每个版本必测"/>
        <node TEXT="Fail 数量不超过 0"/>
      </node>
      <node TEXT="P2 一般">
        <node TEXT="一般功能场景"/>
        <node TEXT="按需执行"/>
        <node TEXT="Fail 可挂起评估"/>
      </node>
      <node TEXT="P3 边缘">
        <node TEXT="低频边缘场景"/>
        <node TEXT="时间充裕时执行"/>
        <node TEXT="可延期到下个迭代"/>
      </node>
    </node>

    <node TEXT="6. 用例组织结构（三层）" POSITION="left">
      <node TEXT="# 模块名（一级标题）"/>
      <node TEXT="## 子模块名（二级标题）"/>
      <node TEXT="表格：每子模块一张，TC 全局连续"/>
      <node TEXT="落盘：test/testcases/test_{模块名}-testcases.md"/>
      <node TEXT="mm 顶节点：功能模块名称"/>
    </node>

    <node TEXT="6.1 具体测试数据要求" POSITION="left">
      <node TEXT="禁止：描述输入50字合法内容"/>
      <node TEXT="正确：写出完整具体字符串"/>
      <node TEXT="禁止：输入合法值"/>
      <node TEXT="正确：输入 buffett-audit"/>
      <node TEXT="禁止：输入非法格式"/>
      <node TEXT="正确：输入 MySkill@name"/>
    </node>

    <node TEXT="7. 输出格式" POSITION="left">
      <node TEXT="Markdown 表格（对话阅读）"/>
      <node TEXT="xlsx 详见 testcase-excel-export-standard.mdc">
        <node TEXT="12 列：编号/模块/子模块/标题…优先级"/>
        <node TEXT="单 Sheet，B 列模块纵向合并"/>
        <node TEXT="标题列【模块】前缀（仅 Excel）"/>
        <node TEXT="export_excel.py 导出"/>
      </node>
      <node TEXT="mm：FreeMind，同脚本导出"/>
      <node TEXT="多步骤：步骤/预期用 → 分隔"/>
    </node>

    <node TEXT="8. 示例（登录模块）" POSITION="left">
      <node TEXT="密码登录">
        <node TEXT="TC-001 提交有效密码登录｜P0"/>
        <node TEXT="TC-002 拒绝空密码提交｜P1"/>
        <node TEXT="TC-003 拒绝全部为空提交｜P1"/>
        <node TEXT="TC-004 限制超长密码输入｜P2"/>
      </node>
      <node TEXT="验证码登录">
        <node TEXT="TC-005 发送验证码并成功登录｜P0"/>
        <node TEXT="TC-006 拒绝过期验证码登录｜P1"/>
      </node>
    </node>

  </node>
</map>
