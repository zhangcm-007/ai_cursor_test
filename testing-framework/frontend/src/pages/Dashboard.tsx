import { useQuery } from "react-query";
import { Card, Row, Col, Typography } from "antd";
import {
  FileTextOutlined,
  AimOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { statsApi } from "../api/stats";

export default function Dashboard() {
  const { data, isLoading } = useQuery("stats", statsApi.get);
  const cards = [
    {
      title: "需求数",
      value: data?.requirements ?? 0,
      icon: <FileTextOutlined />,
      color: "#1890ff",
    },
    {
      title: "测试点数",
      value: data?.testPoints ?? 0,
      icon: <AimOutlined />,
      color: "#52c41a",
    },
    {
      title: "测试用例数",
      value: data?.testCases ?? 0,
      icon: <UnorderedListOutlined />,
      color: "#fa8c16",
    },
  ];
  return (
    <div>
      <Typography.Title level={4}>首页</Typography.Title>
      <Row gutter={16}>
        {cards.map((c) => (
          <Col key={c.title} span={8}>
            <Card loading={isLoading}>
              <Card.Meta
                avatar={<span style={{ fontSize: 24, color: c.color }}>{c.icon}</span>}
                title={c.title}
                description={<span style={{ fontSize: 20 }}>{c.value}</span>}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
