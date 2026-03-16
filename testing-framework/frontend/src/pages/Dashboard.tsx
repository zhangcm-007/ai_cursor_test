import { useQuery } from "react-query";
import { Card, Row, Col, Typography } from "antd";
import {
  FileTextOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { statsApi } from "../api/stats";

export default function Dashboard() {
  const { data, isLoading } = useQuery("stats", statsApi.get);
  const cards = [
    { title: "需求数", value: data?.requirements ?? 0, icon: <FileTextOutlined />, color: "#6366f1" },
    { title: "测试用例数", value: data?.testCases ?? 0, icon: <UnorderedListOutlined />, color: "#f59e0b" },
  ];
  return (
    <div>
      <div className="page-header">
        <Typography.Title level={4} className="page-title">首页</Typography.Title>
        <p className="page-desc">概览需求与测试用例数量</p>
      </div>
      <Row gutter={[20, 20]}>
        {cards.map((c) => (
          <Col key={c.title} xs={24} sm={24} md={12}>
            <Card loading={isLoading} style={{ transition: "box-shadow 0.2s ease, border-color 0.2s ease" }} className="stat-card">
              <Card.Meta
                avatar={<span style={{ fontSize: 28, color: c.color, opacity: 0.95 }}>{c.icon}</span>}
                title={<span style={{ fontSize: 13, color: "#cbd5e1", fontWeight: 500 }}>{c.title}</span>}
                description={<span style={{ fontSize: 26, fontWeight: 600, color: "#f1f5f9", letterSpacing: "-0.02em" }}>{c.value}</span>}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
