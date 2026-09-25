/**
 * Prompt injection detector.
 *
 * Implements advisory heuristic detection per Doc 16 §3B and Threat Model T-01.
 * All regexes are linear-time and avoid nested quantifiers (T-06).
 */

import type { InjectionDetectionResult } from "./types.js";

interface InjectionPattern {
  readonly id: string;
  readonly pattern: RegExp;
}

export const INJECTION_PATTERNS: readonly InjectionPattern[] = [
  // 1. Override phrases
  {
    id: "override_ignore_instructions",
    pattern:
      /\b(?:ignore|disregard|forget|bypass)\s+(?:all\s+|any\s+)?(?:(?:previous|prior|above|system)\s+)?instructions\b/i,
  },
  {
    id: "override_rules_guidelines",
    pattern:
      /\b(?:ignore|disregard|forget|bypass|override)\s+(?:all\s+|any\s+)?(?:rules|guidelines|policies|constraints)\b/i,
  },
  {
    id: "override_prompt_reset",
    pattern:
      /\b(?:reset|clear|erase)\s+(?:your\s+)?(?:instructions|context|memory|system\s+prompt)\b/i,
  },
  {
    id: "override_start_over",
    pattern: /\bstart\s+over\s+and\s+(?:follow|obey|execute)\b/i,
  },

  // 2. Role hijack
  {
    id: "role_hijack_you_are_now",
    pattern: /\byou\s+are\s+now\s+(?:an?|the|a\s+new)\b/i,
  },
  {
    id: "role_hijack_act_as",
    pattern:
      /\bact\s+as\s+(?:an?|the)\s+(?:unrestricted|evil|dan|developer|root|admin|hacker|bot|assistant)\b/i,
  },
  {
    id: "role_hijack_developer_mode",
    pattern: /\bdeveloper\s+mode\s+(?:is\s+)?(?:enabled|activated|on)\b/i,
  },
  {
    id: "role_hijack_dan_jailbreak",
    pattern: /\b(?:DAN\s+mode|jailbreak\s+mode|unfiltered\s+mode)\b/i,
  },
  {
    id: "role_hijack_system_prompt_leak",
    pattern:
      /\b(?:print|reveal|show|dump|output)\s+(?:the\s+)?(?:system\s+prompt|initial\s+instructions)\b/i,
  },

  // 3. Tool-steering
  {
    id: "tool_steering_call_tool",
    pattern: /\b(?:call|invoke|execute|run)\s+(?:the\s+)?(?:tool|function|plugin|mcp_tool)\b/i,
  },
  {
    id: "tool_steering_use_tool",
    pattern: /\buse\s+(?:the\s+)?(?:tool|command|shell|exec|api)\b/i,
  },
  {
    id: "tool_steering_send_email",
    pattern:
      /\b(?:send|forward|dispatch)\s+(?:an?\s+)?(?:email|cv|resume|profile|attachment)\s+to\b/i,
  },
  {
    id: "tool_steering_forward_data",
    pattern: /\bforward\s+(?:this|the|all|user)\s+(?:data|cv|resume|token|secret|details)\s+to\b/i,
  },
  {
    id: "tool_steering_delete_all",
    pattern:
      /\b(?:delete|drop|purge|wipe|destroy)\s+(?:all\s+)?(?:data|database|files?|profiles?|jobs?)\b/i,
  },
  {
    id: "tool_steering_upload_exfil",
    pattern: /\bupload\s+(?:the\s+)?(?:file|data|database|secrets?|tokens?|cv)\s+to\b/i,
  },

  // 4. Chat-template tokens
  {
    id: "chat_template_im_start",
    pattern: /<\|im_start\|>/i,
  },
  {
    id: "chat_template_im_end",
    pattern: /<\|im_end\|>/i,
  },
  {
    id: "chat_template_inst",
    pattern: /\[\/?INST\]/i,
  },
  {
    id: "chat_template_system_header",
    pattern: /###\s*system\b/i,
  },
  {
    id: "chat_template_assistant_header",
    pattern: /###\s*assistant\b/i,
  },
  {
    id: "chat_template_human_header",
    pattern: /###\s*human\b/i,
  },
  {
    id: "chat_template_role_prefix",
    pattern: /^(?:system|assistant|human):\s*/im,
  },

  // 5. Markdown exfiltration
  {
    id: "markdown_exfil_image_query",
    pattern: /!\[[^\]]*\]\(https?:\/\/[^\s)]+\?[^\s)]+\)/i,
  },
  {
    id: "markdown_exfil_link_query",
    pattern: /\[[^\]]*\]\(https?:\/\/[^\s)]+\?[^\s)]*(?:data|exfil|cv|token|key|cookie)=/i,
  },

  // 6. Base64 payload (>= 200 continuous characters, single atomic quantifier)
  {
    id: "base64_blob_large",
    pattern: /[A-Za-z0-9+/]{200,}={0,2}/,
  },

  // 7. Multilingual override phrases (Hindi & Tamil)
  {
    id: "multilingual_hindi_forget_instructions",
    pattern: /पिछले\s+(?:सभी\s+)?निर्देश\s+(?:भूल\s+जाओ|अनदेखा\s+करें)/u,
  },
  {
    id: "multilingual_hindi_follow_new",
    pattern: /नए\s+निर्देश\s+का\s+पालन\s+करें/u,
  },
  {
    id: "multilingual_tamil_ignore_instructions",
    pattern: /முந்தைய\s+வழிமுறைகளை\s+புறக்கணிக்கவும்/u,
  },
  {
    id: "multilingual_tamil_forget_instructions",
    pattern: /முந்தைய\s+வழிமுறைகளை\s+மறந்து\s+விடுங்கள்/u,
  },

  // 8. Delimiter hijacking
  {
    id: "delimiter_prompt_injection",
    pattern: /(?:---|\*\*\*|===)\s*(?:START|END)\s+(?:PROMPT|INSTRUCTION|SYSTEM)/i,
  },
];

/**
 * Scans text for prompt injection signals.
 *
 * Advisory only: does not modify or reject content.
 */
export function detectInjection(text: string): InjectionDetectionResult {
  const signals: string[] = [];

  for (const item of INJECTION_PATTERNS) {
    if (item.pattern.test(text)) {
      signals.push(item.id);
    }
  }

  return {
    suspected: signals.length > 0,
    signals,
  };
}
