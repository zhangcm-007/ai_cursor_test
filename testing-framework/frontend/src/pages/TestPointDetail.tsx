import { useQuery, useMutation, useQueryClient } from "react-query";
import { useParams, Link } from "react-router-dom";
import { Descriptions, Typography } from "antd";
import { testPointsApi } from "../api/test-points";

export default function TestPointDetail() {
  const { id } = useParams<{ id: string }>();
  const client = useQueryClient();
  const { data: testPoint, isLoading } = useQuery(
    ["test-point", id],
    () => testPointsApi.get(id!),
    { enabled: !!id }
  );

  if (!id) return null;
  if (isLoading || !testPoint) return <div>加载中...</div>;

  return (
    <div>
      <Typography.Title level={4}>
        <Link to="/test-points">测试点</Link> / {testPoint.pointId}
      </Typography.Title>
      <Descriptions bordered column={1}>
        <Descriptions.Item label="测试点ID">{testPoint.pointId}</Descriptions.Item>
        <Descriptions.Item label="描述">{testPoint.description || "-"}</Descriptions.Item>
        <Descriptions.Item label="类型">{testPoint.type || "-"}</Descriptions.Item>
        <Descriptions.Item label="所属需求">
          {testPoint.requirement ? (
            <Link to={`/requirements/${testPoint.requirement.id}`}>
              {testPoint.requirement.title}
            </Link>
          ) : (
            "-"
          )}
        </Descriptions.Item>
      </Descriptions>
    </div>
  );
}
