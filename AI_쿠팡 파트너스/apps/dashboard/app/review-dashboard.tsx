"use client";
import { Badge, Box, Button, Flex, Heading, Text } from "@chakra-ui/react";
import { useReviewStore } from "./review-store";

export function ReviewDashboard() {
  const store = useReviewStore();
  return <Box as="main" maxWidth="960px" margin="0 auto" padding={{ base: "5", md: "10" }}>
    <Heading as="h1" size="2xl">콘텐츠 검토</Heading><Text marginTop="2" color="fg.muted">승인 전에는 게시할 수 없습니다.</Text>
    {store.items.map((item) => <Box key={item.id} borderWidth="1px" borderRadius="lg" padding="5" marginTop="6">
      <Flex justify="space-between" gap="4" wrap="wrap"><Box><Heading as="h2" size="md">{item.productName}</Heading><Text>{item.channel} · Compliance {item.complianceScore}</Text></Box><Badge>{item.status}</Badge></Flex>
      <Flex gap="3" marginTop="5" wrap="wrap"><Button onClick={() => { store.approve(item.id); }} disabled={item.status !== "REVIEW_REQUIRED"}>승인</Button><Button variant="outline" onClick={() => { store.reject(item.id, "운영자 검토 반려"); }} disabled={item.status !== "REVIEW_REQUIRED"}>반려</Button></Flex>
      {item.rejectionReason ? <Text marginTop="3">반려 사유: {item.rejectionReason}</Text> : null}
    </Box>)}
  </Box>;
}
