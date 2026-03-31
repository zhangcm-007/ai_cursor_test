import { useQuery } from "react-query";
import { Table, Tag, Typography } from "antd";
import { Link } from "react-router-dom";
import { apiRegressionApi } from "../api/api-regression";

export default function ApiRegressionRuns() {
  const { data = [], isLoading } = useQuery("api-runs", () => apiRegressionApi.runs.list(100));

  return (
    <div>
      <Typography.Title level={4} className="page-title">
        接口测试 · 运行历史
      </Typography.Title>
      <p className="page-desc">查看每次运行的环境快照与结果；详情含步骤与断言。</p>
      <Table
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        columns={[
          {
            title: "状态",
            dataIndex: "status",
            width: 100,
            render: (s: string) => (
              <Tag color={s === "PASSED" ? "success" : s === "FAILED" ? "error" : "processing"}>{s}</Tag>
            ),
          },
          {
            title: "环境",
            dataIndex: "environmentName",
            render: (t, r) => (
              <span>
                {t} <Typography.Text type="secondary">({r.baseUrlSnapshot})</Typography.Text>
              </span>
            ),
          },
          { title: "模式", dataIndex: "regressionMode", width: 90 },
          { title: "触发", dataIndex: "triggeredBy", width: 100 },
          {
            title: "开始时间",
            dataIndex: "startedAt",
            width: 200,
            render: (t: string) => (t ? new Date(t).toLocaleString() : ""),
          },
          {
            title: "操作",
            width: 90,
            render: (_, r) => <Link to={`/api-tests/runs/${r.id}`}>详情</Link>,
          },
        ]}
      />
    </div>
  );
}
