import { Box, Heading, Text } from "@chakra-ui/react";

export interface AppShellProps {
  title: string;
  description: string;
}

export function AppShell({ title, description }: AppShellProps) {
  return (
    <Box as="main" maxWidth="960px" margin="0 auto" padding="10">
      <Heading as="h1" size="2xl">{title}</Heading>
      <Text marginTop="4" color="fg.muted">{description}</Text>
    </Box>
  );
}
