import { useQuery } from "react-query";
import { useParams, Link } from "react-router-dom";
import { Descriptions, Typography } from "antd";
import { testCasesApi } from "../api/test-cases";

export default function TestCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: testCase, isLoading } = useQuery(
    ["test-case", id],
    () => testCasesApi.get(id!),
    { enabled: !!id }
  );

  if (!id) return null;
  if (isLoading || !testCase) return <div>加载中...</div>;

  return (
    <div>
      <div className="page-header">
        <Typography.Title level={4} className="page-title" style={{ marginBottom: 0 }}>
          <Link to="/test-cases">测试用例</Link> / {testCase.caseId}
          {testCase.requirement && (
            <>
              {" "}
              / <Link to={`/requirements/${testCase.requirement.id}`}>{testCase.requirement.title}</Link>
            </>
          )}
        </Typography.Title>
      </div>
      <Descriptions bordered column={1}>
        <Descriptions.Item label="用例编号">{testCase.caseId}</Descriptions.Item>
        <Descriptions.Item label="一级功能点">{testCase.featurePointL1 || "-"}</Descriptions.Item>
        <Descriptions.Item label="二级功能点">{testCase.featurePoint || "-"}</Descriptions.Item>
        <Descriptions.Item label="标题">{testCase.title}</Descriptions.Item>
        <Descriptions.Item label="优先级">{testCase.priority || "-"}</Descriptions.Item>
        <Descriptions.Item label="前置条件">{testCase.preconditions || "-"}</Descriptions.Item>
        <Descriptions.Item label="测试步骤">
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{testCase.steps || "-"}</pre>
        </Descriptions.Item>
        <Descriptions.Item label="预期结果">{testCase.expected || "-"}</Descriptions.Item>
        <Descriptions.Item label="验证点">
          {testCase.validationPoints ? (
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{testCase.validationPoints}</pre>
          ) : (
            "-"
          )}
        </Descriptions.Item>
        <Descriptions.Item label="所属需求">
          {testCase.requirement ? (
            <Link to={`/requirements/${testCase.requirement.id}`}>
              {testCase.requirement.title}
            </Link>
          ) : (
            "-"
          )}
        </Descriptions.Item>
      </Descriptions>
    </div>
  );
}
