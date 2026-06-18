"""AWS Bedrock LLM provider (stub).

Placeholder for the AWS migration. When ready, implement `chat` using the
Bedrock Converse API (bedrock-runtime), which has native tool-use support and
maps cleanly onto the LLMResponse / ToolCall shapes. The agent loop and the tool
layer need no changes — only this file.

Sketch of the real implementation:

    import boto3
    self.client = boto3.client("bedrock-runtime", region_name=region)
    resp = self.client.converse(
        modelId=self.model,
        messages=converse_messages,            # role/content blocks
        toolConfig={"tools": converse_tools},  # translated from tool schemas
    )
    # then map resp["output"]["message"]["content"] toolUse blocks -> ToolCall
"""
from providers.base import LLMProvider, LLMResponse, ToolCall


class BedrockProvider(LLMProvider):
    def __init__(self, model: str, region: str):
        self.model = model
        self.region = region

    def chat(self, messages: list[dict], tools: list[dict]) -> LLMResponse:
        raise NotImplementedError(
            "BedrockProvider is not implemented yet. Set LLM_PROVIDER=ollama, "
            "or implement chat() with the Bedrock Converse API for the AWS migration."
        )

    def append_assistant(self, messages: list[dict], response: LLMResponse) -> None:
        raise NotImplementedError

    def append_tool_result(self, messages: list[dict], call: ToolCall, content: str) -> None:
        raise NotImplementedError
