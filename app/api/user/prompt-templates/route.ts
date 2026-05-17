import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { users } from "@/lib/db";
import { PromptTemplateType } from "@/lib/db/types";
import {
  DEFAULT_DEAL_EMAIL_PROMPT,
  DEFAULT_CUSTOMER_EMAIL_PROMPT,
  DEFAULT_NOTES_PROMPT,
} from "@/lib/gemini/email-generation";

/**
 * GET /api/user/prompt-templates
 * Returns user's custom templates and the defaults for comparison
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await users.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const templates = await users.getUserPromptTemplates(user.id);

    return NextResponse.json({
      templates: {
        deal_email: {
          custom: templates.deal_email_prompt_template,
          default: DEFAULT_DEAL_EMAIL_PROMPT,
          isCustomized: !!templates.deal_email_prompt_template,
        },
        customer_email: {
          custom: templates.customer_email_prompt_template,
          default: DEFAULT_CUSTOMER_EMAIL_PROMPT,
          isCustomized: !!templates.customer_email_prompt_template,
        },
        notes: {
          custom: templates.notes_prompt_template,
          default: DEFAULT_NOTES_PROMPT,
          isCustomized: !!templates.notes_prompt_template,
        },
      },
      // Available placeholders for user reference
      placeholders: [
        "{meeting_name}",
        "{meeting_date}",
        "{customer_name}",
        "{meeting_owner}",
        "{extracts}",
        "{action_items}",
        "{participants}",
      ],
    });
  } catch (error) {
    console.error("Error fetching prompt templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompt templates" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/prompt-templates
 * Update a specific prompt template
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await users.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { templateType, template } = body as {
      templateType: PromptTemplateType;
      template: string;
    };

    if (!templateType || !["deal_email", "customer_email", "notes"].includes(templateType)) {
      return NextResponse.json(
        { error: "Invalid template type. Must be: deal_email, customer_email, or notes" },
        { status: 400 }
      );
    }

    if (!template || typeof template !== "string") {
      return NextResponse.json(
        { error: "Template content is required" },
        { status: 400 }
      );
    }

    await users.updateUserPromptTemplate(user.id, templateType, template);

    return NextResponse.json({
      success: true,
      message: `${templateType} template updated successfully`,
    });
  } catch (error) {
    console.error("Error updating prompt template:", error);
    return NextResponse.json(
      { error: "Failed to update prompt template" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/prompt-templates
 * Reset a specific prompt template to default (sets to NULL)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await users.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { templateType } = body as { templateType: PromptTemplateType };

    if (!templateType || !["deal_email", "customer_email", "notes"].includes(templateType)) {
      return NextResponse.json(
        { error: "Invalid template type. Must be: deal_email, customer_email, or notes" },
        { status: 400 }
      );
    }

    await users.resetUserPromptTemplate(user.id, templateType);

    return NextResponse.json({
      success: true,
      message: `${templateType} template reset to default`,
    });
  } catch (error) {
    console.error("Error resetting prompt template:", error);
    return NextResponse.json(
      { error: "Failed to reset prompt template" },
      { status: 500 }
    );
  }
}
