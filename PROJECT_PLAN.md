# Project Overview and Specifications
This is an app for managing meetings with customers for Marker Learning, special education psychologists, district special education supervisors, and other support staff for special education that Marker interacts with as part of the sales and customer success process. It extracts structured data (fields) from meeting transcripts based on a set of rules of the important information to extract, and enables Marker Learning sales and customer success personnel to automate gathering, summarizing, finding next steps, and acting on the outcomes of meetings. The system integrates with Google Meet and Zoom as the sources for meeting data and transcripts, and presents a searchable interface as a web app and mobile web app of meeting outcomes by date or customer, writes notes and action items to the Hubspot customer record, and other workflow items (e.g generates drafts of follow-up emails immediately after each meeting, creates Bugs in Linear, or creates feature requests in Linear).

The system must be built with nextjs, Vercel, Vercel Blob Storage, Neon postgres, and Gemini file and AI APIs, and will be staged and deployed on Vercel. When the time comes for credentials for these services, please store them in a way compatible with Vercel’s environment variables management (in the .vercel/.env.local.development file, symlinked as necessary so that Vercel maintains these env variables).

## Key Architecture Concepts
### 1. Data Extraction Layer
- **Purpose**: Extract comprehensive structured data from meeting recordings using Gemini file API for text extraction and data structure, according to a simple ontology of relationships between parts of a schema of fields, below. If a transcript already exists, copy it to storage.
- **Storage**: PostgreSQL for all field data (events, transcripts, extracted data). 

### 2. Schema
The fields extracted from each set of case documents must include the below, must be extensible to support any other functions of the application, and must be stored in an extensible database schema of fields. Fields prefixed with a @ character should be references to values stored in another part of the schema (e.g. the customer role associated with a meeting must only be a reference to a full record/object for that unique role in another data store). Fields with a [] suffix are an array of values. Please ensure that all tables have usual CRUD pattern (e.g. created at dates, updated-at dates).
* Customer: CustomerId, Name, Address
* Personnel: @PersonnelId, Name, Title, @CustomerId, @RoleId, @GroupId
* Role: RoleId, RoleName (e.g. Psychologist, Speech-Language Pathologist), description
* Group: GroupId, GroupName (e.g. school department)
* Meeting: MeetingId, MeetingName, MeetingDate, @CustomerId, Participants [] (an array of personnel ids), Transcript, UserNotes, Extracts [], WorkflowStatus
* ExtractRule: ExtractRuleId, ExtractRuleName, ExtractRuleSummary, ExtractRuleQuotes [], ExtractRuleTags [], ActionItems[]
* Tag: TagId, TagName, TagType
* Extract: @MeetingId, @CustomerId, Participants [], Date, Summary, Tags [], Quotes []
* Workflow: WorkflowId, WorkflowName, Summary, Steps[], WorkflowStatus, WorkflowActive
* WorkflowStep: WorkflowStepId, WorkflowStepTypeId, WorkflowStepName, Trigger, ActionItem
* WorkflowStepType: WorkflowStepTypeId, WorkflowStepTypeName (e.g. draft email, create Hubspot task, create product feature request, create bug).  

### 3. Setup Process
The app should use Google Authentication to authenticate users, and only allow employees with a markerlearning.com email to access the app. Upon login, the app should:
1. Ask for permission to access the Zoom, Google Meet, and Hubspot accounts for the authenticated user, and allow a user to see connected services (and revoke access) in a preferences area accessible from the user-avatar menu.
2. If Hubspot is connected, retrieve a list of customer organizations and individuals associated with the authenticated user from Hubspot and create records in the CustomerOrganization and Personnel tables. 
3. If Google Meet or Zoom is connected, connect to those services and retrieve meeting details and transcripts for meetings within the last 14 days and create records in the appropriate tables. 
4. Show the user an overview with lists of meetings (and actions for each meeting), customers, and setup of workflow and extract rules.

### 4. Extract Rules Flow
The app should support creating extraction rules based on a user uploading transcripts and user notes via a prompt (see below), and display a list of rules for user to update, delete, or create. 

### 5. Meeting Data Flow
The app should support the following flow for handling meetings. The app should:
1. Connect to Google Meet and Zoom accounts, find meetings within the last 7 days.
2. Create a new record in a Neon Meetings table for each meeting, determine whether a transcript is available, and copy either the recording file to Vercel blob storage or the transcript to the Meeting record. Save the email addresses of each non-Marker Learning participant in a meeting to the meeting record. Store the user account used to retrieve the meeting recording or transcript as the host of the meeting.
3. For recordings, create an API request to Gemini FilesAPI to extract the text from the file and await the response, then store the extracted transcript in the Meetings table. 
4. Identify the customer or deal company from the meeting data or transcript and match it with Hubspot deals or customer companies (or allow the user to add the customer or deal later if not possible to determine). 
5. Using the extract rules data, analyze and find extracts from each meeting transcript, then add each to an extracts table record.
6. If any action items are found in the meeting, the actions should be added to the meeting data.
7. After a meeting has been processed for extracts; if the meeting has been matched with a company or deal it should display a "start workflow" button that allows a workflow to be started, otherwise it should show a selector to choose a customer or deal (once a deal or customer is selected, it should show the workflow button).

### 6. Workflows
A workflow is a set of default action that are taken for meetings that have been processed, based on whether they are a prospective deal or a current customer: 
* For companies that are associated with a deal: draft notes and follow-up email text with action items, display drafts in the meeting page, and send meeting details and drafts in an email to the user.
* For companies that are current customers: Draft notes, follow-up email text with action items, and feature-request tickets, display drafts in the meeting page, and send meeting details and drafts to the meeting user by email.

### 7. Prompts
Use the below prompts with Gemini 3 Pro to generate extraction rules based on uploaded pairs of meeting transcripts and user notes:
	# CRITICAL RULES - MUST FOLLOW 
	## NO MOCKS, NO TESTS, NO FALLBACKS - EVERYTHING MUST BE REAL - 
	**NEVER create mock or sample content** 
	- Everything should connect to real transcript information - 
	**NEVER create test or sample data** 
	- **Update Status** Create or update a STATUS.md artifact with a summary of progress and the current state of the project. 
	- **Fix all Errors** - Make sure that if you encounter errors 
	accessing files or data that you ask for help or fix problems before 
	stating that work is complete.
	
	# BACKGROUND
	You are a knowledge engineer working to learn how to extract useful 
	insights from a large amount of calls and interactions with customers 
	and prospects, in a way that can be useful across an organization. 
	For each call, you will compare the human-created notes from the call 
	with the transcript, and prepare a set of tags, keywords, and example 
	quotes that capture the valuable parts of the calls or meetings. 
	This material will form the basis for an automated extraction process 
	that will be developed later. 
	
	# PROCESS TO FOLLOW
	1. Analyze this set of calls and meeting files, making sure that for each call or meeting you have both
	  a. human-written notes and 
	  b. a recording or transcript.
	2. Using the human-created notes, analyze each transcript or recording, 
	and find the corresponding quote for that note in that call or meeting, 
	then extract that quote. Avoid parts where participants discussed other topics and just focus on when a business process or software was discussed, 
	and finding as many descriptions of process, reactions and expressed 
	opinions as possible. If possible to determine for each quote, include 
	person and their role. If there are specific action items associated with an extract, set an "isActionItem" flag. Exclude any processes, reactions or opinions that seem to be from interviewers or employees of the Marker Learning.
	Be absolutely sure that quotations are excerpts from a transcript and 
	you have captured every single process, reaction or opinion. 
	3. Create a unique identifier for each call or meeting.
	4. Create very brief summary for each extract, using less than 256 characters.
	5. For each extract, add tags for useful and relevant themes, topics, or 
	categories of information mentioned, using this set of tags as a starting 
	point: feature_request, user_confusion, document_tracking_issues, reporting, 
	user_interface_issue, login_issues, missing_data, search_issues, 
	help_desk_tickets, template_needs, organizational_structure, 
	deployment_strategy, billing_issues, positive_feedback, negative_feedback, 
	user_support, parse_accuracy, data_accuracy, troubleshooting, onboarding, 
	integration_issues, reporting_process, policy_enforcement, workflow_process, 
	best_practices, client_management, workflow_changes, deal_timeframes, 
	deployment_issues, deployment_timeframe, product_feedback, bug_reports, 
	training_requests, app_performance_issues. Where needed add tags. 
	Make sure that every extract has at least one tag but not more than five. 
	6. For each extract, add 5-10 keywords, which give a sense of the extract 
	subject and context beyond the tags.
	7. For each extract, add the meeting identifier, organization, participants, 
	roles, date, quote, summary, keywords, and tags to a XLS spreadsheet file.
	8. Create a JSON object and save it as EXTRACTION_RULES.json with the below 
	structure for all extracts:
	`{
	      "meeting_uuid": "UUID for the meeting",
	      "organization": "name of the organization, if possible to identify"
	      "group": "name of the part of org, if possible to identify"
	      "participants": "names of the people interviewed, if possible to 
	      identify",
	      “roles”: “roles of the people interviewed, if possible to identify”,
	      "date": "date of the call or meeting, if possible to identify"
	      "extracts": [
	    {
	      "quote": "Quote from the call or meeting“,
	      “summary”: “summary of the extract”,
	      “keywords”: “specific keywords that identify the quote or extract”,
	      "isActionItem": "true/false",
	      "tags": ["tag_name", "tag_name"]
	    }
	  ]
	}```;

Use the below prompt for generating extracts from new meetings based on extraction rules:
	# CRITICAL RULES - MUST FOLLOW 
	## NO MOCKS, NO TESTS, NO FALLBACKS - EVERYTHING MUST BE REAL - 
	**NEVER create mock or sample content** 
	- Everything should connect to real transcript information - 
	**NEVER create test or sample data** 
	**Update Status** 
	- Create or update a EXTRACT-STATUS.md artifact with a summary of progress and the current state of the project. 
	- **Fix all Errors** - Make sure that if you encounter errors 
	accessing files or data that you ask for help or fix problems before 
	stating that work is complete.
	
	# BACKGROUND
	You are a knowledge engineer working to learn how to extract useful 
	insights from a large amount of calls and interactions with customers 
	and prospects, in a way that can be useful across an organization. 
	For each call, you will extract a transcript, use a set of rules in 
	EXTRACT_RULES.json to process the call or meeting, and pull a set of quotes
	with tags that capture the valuable parts of the calls or meetings. 
	This material will be used in workflows for distilling knowlege or creating 
	reports. 
	
	# PROCESS TO FOLLOW
	1. Analyze these meetings or calls, making sure that for each 
	call or meeting you have a good recording or transcript, and producing a 
	transcript where needed. Make sure that the data used for each meeting
	is based on actual transcripts, not produced by ai or you.
	3. Create an identifier for each call or meeting.
	4. Identify the customer or deal company from the meeting data or transcript 
	and match it with a Hubspot deal or customer company, and add that company id.
	If not possible to determine, leave as null so a user can select or add. 
	4. Extract a set of quotes that have a similar theme, focus, or subject
	as in the EXTRACTION_RULES.json. Avoid quotes where participants discussed 
	other topics and just focus on when a business process or software was 
	discussed, finding as many descriptions of process, reactions and expressed 
	opinions as possible. If possible to determine for each quote, include 
	person and their role. If there are specific action items associated with an 
	extract, set an "isActionItem" flag. Exclude any processes, reactions or 
	opinions that seem to be from interviewers or employees of the Marker Learning. 
	Be absolutely sure that quotations are excerpts from a transcript and 
	you have captured every single process, reaction or opinion.
	5. For each extract, add tags for useful and relevant themes, topics, or 
	categories of information mentioned, using this set of tags as a starting 
	point: feature_request, user_confusion, document_tracking_issues, reporting, 
	user_interface_issue, login_issues, missing_data, search_issues, 
	help_desk_tickets, template_needs, organizational_structure, 
	deployment_strategy, billing_issues, positive_feedback, negative_feedback, 
	user_support, parse_accuracy, data_accuracy, troubleshooting, onboarding, 
	integration_issues, reporting_process, policy_enforcement, workflow_process, 
	best_practices, client_management, workflow_changes, deal_timeframes, 
	deployment_issues, deployment_timeframe, product_feedback, bug_reports, 
	training_requests, app_performance_issues. Where needed add tags. 
	Make sure that every extract has at least one tag but not more than five.
	6. Create a JSON object and save it as EXTRACTS.json with the below 
	structure for all extracts:
	`{
	      "meeting_uuid": "UUID for the meeting",
	      "company": "name of the deal or customer company, if possible to identify",
		  "companyId": "record id for the company, if possible to identify",
	      "group": "name of the part or group within a company, if possible to identify"
	      "participants": "names of the people interviewed, if possible to 
	      identify",
		  "participant emails": "email addresses of the non-marker learning 
		  participants in the meeting, if possible to gather from the meeting details",
	      “roles”: “roles of the people interviewed, if possible to identify”,
	      "date": "date of the call or meeting, if possible to identify"
	      "extracts": [
	    {
	      "quote": "quote from the call or meeting“,
	      “summary”: “summary of the extract”,
	      "tags": ["tag_name", "tag_name"],
	      "isActionItem": "true/false",
		  "participantName: "name of source of quote or assignee for action item",
		  "participantEmail: "email address of source of quote or 
		  assignee for action item",
	    }
	  ]
	}```;

Use the below prompts for generating followup items for deals or customers:
# CRITICAL RULES - MUST FOLLOW 
## NO MOCKS - EVERYTHING MUST BE REAL - **NEVER create mock or sample content** 
- Everything should connect to real meeting information 
- **NEVER create test or sample data** 
- **Fix all Errors** - Make sure that if you encounter errors accessing files or data that you ask for help or fix problems before stating that work is complete.
	
# BACKGROUND
You are a knowledge engineer working to use extracts from meetings with customers 
and prospects based on the style and preferences of sales and customer success people at Marker Learning. Note: If an extract is ambiguous, refer to the source transcript for a meeting. Wherever it is useful, include quotes and participant names. For email drafts, include participant names and email addresses. For notes and tickets, include the meeting host name and email along with the participant names.

# PROCESS TO FOLLOW
1. For each meeting, read all excerpts, and determine whether the meeting was for a prospective deal or a current customer. 
2. If the meeting was for a prospective deal, using the "deal" json template information below, draft a warm and friendly followup email to participants with a summary of the meeting and action items, then draft a set of internal notes, and save that information.
3. If the meeting was for a current customer, using the "customer" json template information below, draft a warm and friendly followup email to participants with a summary of the meeting and action items, then draft a set of internal notes, then draft a set of internal feature request tickets for customer requests, and save that information. 

## Deal Template info
	`{
  "template_metadata": {
    "name": "Post-Meeting Follow-Up Email",
	"emails": "[{{email1}}, {{email2}}...]",
	"recipients": "name1, name2",
    "author": "{{meeting_owner}}",
    "use_case": "Send within 24-48 hours after initial sales meeting with prospective district"
  },

  "email": {
    "subject": {
      "suggested": "Great connecting - Marker Learning recap and next steps",
      "notes": "Keep brief; reference the meeting or partnership"
    },

    "greeting": {
      "format": "Hi {{contact_names}}!",
      "examples": [
        "Hi {{participant_name}} team!",
        "Hi {{participant_name}}, {{participant_name}} and {{participant_name}},",
        "Hi {{participant_name}} (please fwd to {{participant_name}} too since I didn't get her email)",
        "Hi {{participant_name}}!"
      ],
      "notes": "Use first names. If missing an email, ask recipient to forward."
    },

    "opening": {
      "template": "It was so great speaking to you {{meeting_timeframe}}{{personalized_detail}}. I am excited to hopefully support you and the {{district_name}} team this spring and beyond!",
      "fields": {
        "meeting_timeframe": {
          "type": "select",
          "options": ["today", "yesterday"],
          "default": "today"
        },
        "personalized_detail": {
          "type": "text",
          "optional": true,
          "examples": [
            " and learning more about how the year has been",
            " and learning about your role at Philadelphia, Drexel and in your private practice (don't know how you do it all!)",
            ", thank you again for the time"
          ],
          "notes": "Reference something specific from the conversation to show you were listening"
        },
        "district_name": {
          "type": "text",
          "required": true,
          "examples": ["Houston", "Greenville", "La Porte", "Cypress Fairbanks", "Philadelphia"]
        }
      },
      "additional_personalization": {
        "type": "text",
        "optional": true,
        "examples": [
          "{{participant_name}} - I texted {{participant_name}} to tell her you would be reaching out and she said 'I love her so much!' and is excited to speak to you about our partnership.",
          "I am looking forward to filling in the vendor approval forms!"
        ],
        "notes": "Add any warm personal touches, references to mutual connections, or immediate action items"
      }
    },

    "transition": {
      "template": "As promised, I have provided a recap below and next steps",
      "variations": [
        "As promised, I have provided a recap and next steps below:"
      ],
      "notes": "This is standard boilerplate - minimal variation needed"
    },

    "recap_section": {
      "header": "Recap",
      "items": [
        {
          "id": "value_prop",
          "type": "required",
          "template": "Our goal is to save {{staff_types}} 50%+ of report writing time{{impact_details}}",
          "fields": {
            "staff_types": {
              "type": "multi-select",
              "options": ["school psychs", "Diags", "diagnosticians", "SLPs", "SpEd staff"],
              "examples": [
                "school psychs, diags and other SpEd staff",
                "School Psychs and Diagnosticians",
                "school psychs and SpEd staff"
              ]
            },
            "impact_details": {
              "type": "text",
              "optional": true,
              "examples": [
                ", which reduces burnout and the need for contract support",
                ", which has reduced burn out and the need for contractors",
                " - for a district of La Porte's size that will be 3,000+ hours",
                " (~5hrs per report), which would equate to 58,000+ hours of time saved at CF and reduced staff burn out"
              ],
              "notes": "Customize based on district size and pain points discussed"
            }
          }
        },
        {
          "id": "partnership_options",
          "type": "required",
          "template": "Partnership options: {{pilot_details}}{{full_year_details}}",
          "fields": {
            "pilot_details": {
              "type": "text",
              "required": true,
              "examples": [
                "We have a pilot program that would cost $10,000 and would be up to 15 school psychs and diags",
                "Our pilot program is for up to 10 SpEd staff during the Spring to demonstrate time savings and report quality (cost $5,000)",
                "We have a pilot program (currently a waitlist) that is for ~10 school psychs for $10,000",
                "We have a pilot program that would last 5 months (cost is $10,000) for up to 15 school psychs and diags"
              ]
            },
            "full_year_details": {
              "type": "text",
              "optional": true,
              "examples": [
                ". The full cost of the partnership for all Psychs, Diags and SLPs next year would be $22,000",
                "; during the pilot program we would expect to meet time savings goals and other success metrics set by you and the team"
              ],
              "notes": "Include if full-year pricing was discussed"
            },
            "special_terms": {
              "type": "text",
              "optional": true,
              "examples": [
                "the cost of the pilot is typically $10,000 but we will waive that for you for the spring 2025 because of the budget pressures you mentioned for this year (next year full year cost would be $33,000)"
              ],
              "notes": "Include any negotiated discounts or special arrangements"
            }
          }
        },
        {
          "id": "cost_inclusions",
          "type": "required",
          "template": "Costs include all onboarding, training and support and is for an unlimited number of reports created on the platform (there are no other costs beyond the partnership fee)",
          "notes": "Standard boilerplate - use as-is"
        },
        {
          "id": "onboarding_description",
          "type": "required",
          "template": "Onboarding consists of creating {{template_type}} in the Marker platform and training the team (1 hour virtual training and unlimited amount of additional training)",
          "fields": {
            "template_type": {
              "type": "select",
              "options": [
                "templates",
                "the district template(s)",
                "the {{district_name}} district template(s)"
              ],
              "default": "the district template(s)"
            }
          }
        },
        {
          "id": "roi_calculation",
          "type": "optional",
          "template": "The expected time savings for the Marker platform for {{district_name}} would be {{hours_saved}} hours (which equates to {{contractor_equivalent}} full time contractors and over {{cost_savings}} in contractor spend savings)",
          "fields": {
            "hours_saved": { "type": "number" },
            "contractor_equivalent": { "type": "number" },
            "cost_savings": { "type": "currency" }
          },
          "notes": "Include when ROI was specifically discussed or requested. Can link to ROI calculation document.",
          "example": "The expected time savings for the Marker platform for Houston would be 90,000 hours (which equates to 61 full time contractors and over $6,000,000 in contractor spend savings) - here is the ROI calculation showing that we are 90% less expensive than using contractors"
        },
        {
          "id": "additional_offerings",
          "type": "optional",
          "template": "{{custom_offering}}",
          "examples": [
            "We have recently launched SLP functionality that we can test with members of {{participant_name}}'s team this spring"
          ],
          "notes": "Include any additional products/services discussed"
        }
      ]
    },

    "next_steps_section": {
      "header": "Next steps",
      "items": [
        {
          "id": "share_presentation",
          "type": "standard",
          "template": "{{meeting_owner}} share presentation (linked here)",
          "notes": "Include hyperlink to presentation deck"
        },
        {
          "id": "calendar_invite",
          "type": "standard",
          "template": "{{meeting_owner}} to send calendar invite for {{next_meeting_date}} (completed)",
          "fields": {
            "next_meeting_date": {
              "type": "datetime",
              "examples": ["Jan 28th 11am", "1/27 11:30am", "11am 1/20", "Jan 6 11am"]
            }
          }
        },
        {
          "id": "contract_attachment",
          "type": "optional",
          "template": "{{meeting_owner}} attach contract (attached)",
          "notes": "Include when prospect requested contract"
        },
        {
          "id": "prospect_action_items",
          "type": "required",
          "template": "{{contact_name}} to {{action_item}}",
          "examples": [
            "{{participant_name}} to share vendor approval forms",
            "{{participant_name}} to speak to her supervisor about the pilot program possibility",
            "{{participant_name}} and {{participant_name}} to speak to their Director about the pilot program and potential budget for broader roll out next year if success metrics hit in the spring",
            "Team to discuss budget for spring pilot ($10,000)",
            "{{participant_name}} to speak to {{participant_name}} about her/Prosper's experience with Marker"
          ],
          "notes": "Always include at least one action item for the prospect to maintain momentum"
        },
        {
          "id": "procurement_note",
          "type": "optional",
          "template": "Please let me know if you or the IT/Procurement team has any questions about the contract so that we can align on kickoff logistics during our next meeting",
          "notes": "Include when contract was sent or procurement process was discussed"
        }
      ]
    },

    "closing": {
      "question_prompt": {
        "template": "Please let me know if you have any questions",
        "variations": [
          "Please let me know if you have any questions and I am looking forward to connecting again in a few weeks!",
          "Please let me know if you or the IT/Procurement team has any questions"
        ]
      },
      "looking_forward": {
        "template": "I am looking forward to connecting again {{timeframe}}!",
        "fields": {
          "timeframe": {
            "type": "select",
            "options": [
              "in a few weeks",
              "after the holiday",
              "on [date]"
            ]
          }
        }
      },
      "holiday_greeting": {
        "type": "optional",
        "template": "Happy holidays!!",
        "notes": "Include during November-December"
      },
      "signature": {
        "template": "{{meeting_owner}}",
        "notes": "First name only for warm, personal tone"
      }
    }
  },

  "formatting_guidelines": {
    "recap_section": "Use bullet points for each item",
    "next_steps_section": "Use bullet points for each item",
    "tone": "Warm, enthusiastic, professional but not overly formal",
    "length": "Keep concise - email should be scannable"
  },

  "checklist_before_sending": [
    "All contact names spelled correctly",
    "District name is correct throughout",
    "Pricing matches what was discussed",
    "Calendar invite has been sent",
    "Presentation link is working",
    "Contract attached if promised",
    "Next meeting date/time is confirmed",
    "At least one prospect action item included"
  ]
}`

## Customer Template Info
{
  "template_metadata": {
    "name": "Customer Success Meeting Documentation",
    "version": "1.0",
    "use_case": "Document customer success calls and generate follow-up emails, CRM notes, and feature request tickets"
  },

  "meeting_types": {
    "alignment_call": {
      "description": "Initial alignment calls with new partners to establish success metrics and expectations",
      "typical_cadence": "Once at partnership kickoff"
    },
    "partnership_check_in": {
      "description": "Regular check-ins with existing partners to review progress and gather feedback",
      "typical_cadence": "Monthly or bi-weekly"
    },
    "team_connect": {
      "description": "Focus groups or team meetings with multiple end users",
      "typical_cadence": "Quarterly or as needed"
    },
    "individual_meeting": {
      "description": "1:1 calls with specific users to address issues or gather detailed feedback",
      "typical_cadence": "As needed"
    }
  },

  "crm_meeting_note": {
    "header": {
      "hubspot_link": {
        "format": "https://app.hubspot.com/contacts/{{account_id}}/record/0-2/{{record_id}}",
        "required": true
      },
      "date": {
        "format": "MM/DD",
        "required": true
      },
      "meeting_owner": {
        "type": "text",
        "required": true,
        "placeholder": "{{meeting_owner}}"
      },
      "attendees": {
        "type": "list",
        "required": true,
        "format": "{{participant_name}} - {{role/title}}",
        "examples": [
          "{{participant_name}} - assist director and former school psych, {{email_address}}",
          "{{participant_name}} - coord of evals, {{email_address}}",
          "{{participant_name}} - cluster leader, {{email_address}}"
        ]
      },
      "call_recording": {
        "type": "object",
        "optional": true,
        "fields": {
          "share_link": "Zoom/Meet recording URL",
          "passcode": "Recording passcode if applicable",
          "gdrive_location": "Path to recording in shared drive"
        }
      }
    },

    "meeting_summary": {
      "type": "text",
      "required": true,
      "format": "{{date}} call with {{attendees}} = {{internal_attendees}}. {{key_outcome_summary}}. Next meeting {{next_meeting_date}}",
      "examples": [
        "12/16 call with {{participant_name}} = {{meeting_owner}} and {{meeting_owner}}. {{participant_name}} is an assist director and former school psych. {{participant_name}} isn't constrained by budget timeline so would need partnership data by June. He's most concerned with retention, team happiness, \"being a game changer\" for staff - he's going to push the contract/quote through - next meeting 1/20"
      ]
    },

    "sections": {
      "relationship_context": {
        "description": "Personal details to build rapport and remember the human side",
        "optional": true,
        "examples": [
          "coaching her daughter's basketball team",
          "has 2 daughters in 1st and 3rd grade", 
          "counting down to retirement 6 years and 1 month",
          "son is a sophomore in marching band heading to grand championships",
          "had a productive weekend, cleaned out her garage"
        ],
        "notes": "Capture personal details shared - hobbies, family, interests. Helps build authentic relationships."
      },

      "professional_context": {
        "description": "Role, background, tenure, reporting structure",
        "fields": {
          "role_history": "{{years}} at the district, previously {{prior_role}}",
          "team_size": "Number of direct reports or team members",
          "key_relationships": "Who they report to, key stakeholders, influencers",
          "decision_authority": "Budget authority, approval thresholds"
        },
        "examples": [
          "3rd year at the district",
          "diag for 16 years, lead diag 3 years, now coord of evals for 3 years",
          "over $50k needs board approval",
          "$150k or above is board level"
        ]
      },

      "success_metrics": {
        "description": "What outcomes matter to this customer",
        "common_metrics": [
          "time_savings",
          "retention",
          "burnout_reduction",
          "report_quality",
          "work_life_balance",
          "compliance_rates",
          "caseload_management"
        ],
        "capture_format": {
          "metric": "What they want to measure",
          "baseline": "Current state if known",
          "target": "Desired outcome",
          "timeline": "When they need to show results"
        },
        "examples": [
          "retention is their biggest struggle - 2 bigger neighboring districts with more money",
          "needs to be a 'game changer' to justify the price point",
          "wants to relieve hours of time from their work",
          "core reason to use the platform is to give her team a life outside of work, hobbies, not work weekends",
          "6 weeks in to start showing data"
        ]
      },

      "platform_feedback": {
        "positive": {
          "type": "list",
          "examples": [
            "loves the summary feature - this was always the hardest part for her",
            "loves the BASC writeup",
            "cutdown on the mindless numb tasks like transferring scores and changing pronouns",
            "bell curve got a great reaction as a new feature",
            "tables being created for them especially for rating scales"
          ]
        },
        "negative": {
          "type": "list",
          "examples": [
            "taking them more time to edit and review than it is to use",
            "platform requiring tedious review",
            "info is very repetitive across paragraphs",
            "spending a lot of time on deleting the things they don't need"
          ]
        },
        "neutral_observations": {
          "type": "list",
          "examples": [
            "mainly uses marker for the tables and assessment writeup templates",
            "copies and pastes into Frontline, has not used the report as a stand alone",
            "having slightly higher usage with competitor but similar to ours so far"
          ]
        }
      },

      "feature_requests": {
        "type": "list",
        "format": {
          "request": "What they want",
          "user": "Who requested it",
          "context": "Why they need it",
          "priority": "high/medium/low based on frequency and impact"
        },
        "examples": [
          {
            "request": "Post High School dropdown for grade to help with transition programs since they work with students until age 21",
            "context": "Transition program support",
            "priority": "medium"
          },
          {
            "request": "Descriptors for rating scales in the tables",
            "context": "Multiple users requested",
            "priority": "high"
          },
          {
            "request": "Ability to upload a PDF with multiple score reports vs needing to splice each assessment individually",
            "context": "Workflow efficiency",
            "priority": "medium"
          },
          {
            "request": "Flag conflicting pieces in a report from different team members (e.g. SLP vs psych)",
            "context": "Report cohesion and coordination",
            "priority": "medium"
          },
          {
            "request": "Admin view showing usage data - who is using it and how much",
            "context": "Manager visibility",
            "priority": "high"
          }
        ]
      },

      "bugs_and_issues": {
        "type": "list",
        "format": {
          "issue": "Description of the problem",
          "user": "Who experienced it",
          "status": "reported/investigating/resolved",
          "reproduction_steps": "How to reproduce if known",
          "workaround": "Temporary fix if available"
        },
        "examples": [
          {
            "issue": "Gender incorrect in KABC report",
            "user": "{{participant_name}}",
            "status": "reported"
          },
          {
            "issue": "Rating scales overwrite previous edits",
            "status": "resolved - shared tip with team via email"
          },
          {
            "issue": "Handwriting not uploading",
            "workaround": "Worked when user deleted and re-uploaded"
          },
          {
            "issue": "Edits not saving",
            "user": "{{participant_name}}",
            "status": "investigating"
          }
        ]
      },

      "missing_assessments": {
        "description": "Assessments users need that aren't currently supported",
        "type": "list",
        "examples": [
          "WAIS IV",
          "WJ IV", 
          "Piers Harris 3",
          "GORT",
          "WORMT3",
          "RIAS 2"
        ]
      },

      "competitor_mentions": {
        "type": "list",
        "format": {
          "competitor": "Name of competing product",
          "context": "How it came up",
          "sentiment": "positive/negative/neutral",
          "specific_comparison": "What they said about it vs Marker"
        },
        "examples": [
          {
            "competitor": "School Psych AI",
            "context": "Used last year",
            "sentiment": "negative",
            "specific_comparison": "did not have a good experience, hallucinated too much"
          },
          {
            "competitor": "Sophia/School Psych AI",
            "sentiment": "mixed",
            "specific_comparison": "likes Sophia for FBA and BIPs, more flexible, Marker is too rigid"
          }
        ]
      },

      "contract_and_budget": {
        "fields": {
          "current_contract_value": "Dollar amount",
          "renewal_timeline": "When renewal discussions start",
          "budget_constraints": "Any limitations mentioned",
          "approval_process": "Steps needed for contract approval",
          "decision_makers": "Who needs to sign off"
        },
        "examples": [
          "Mid Jan renewal convos start",
          "Feb he starts to decide which contracts they will move forward with",
          "May/June be on the board agenda",
          "$80k quote for next year",
          "trading 1 FTE 80k+ for Marker subscription"
        ]
      },

      "key_users_and_influencers": {
        "description": "Track important individuals within the account",
        "format": {
          "name": "{{participant_name}}",
          "role": "Their position",
          "influence_level": "high/medium/low",
          "sentiment": "champion/neutral/skeptic",
          "notes": "Any relevant context"
        },
        "examples": [
          {
            "name": "{{participant_name}}",
            "influence_level": "high",
            "sentiment": "champion",
            "notes": "loves us, key relationship"
          },
          {
            "name": "{{participant_name}}",
            "influence_level": "medium",
            "sentiment": "skeptic",
            "notes": "not super tech savvy - not surprised she hasn't been leaning in"
          },
          {
            "name": "{{participant_name}}",
            "influence_level": "high",
            "sentiment": "neutral",
            "notes": "most influential people are not using either AI tool - would need to hear it's truly saving time"
          }
        ]
      },

      "action_items": {
        "type": "list",
        "format": {
          "owner": "{{meeting_owner}} or {{participant_name}}",
          "action": "What needs to be done",
          "due_date": "When it should be completed",
          "status": "pending/in_progress/completed"
        },
        "examples": [
          {
            "owner": "{{meeting_owner}}",
            "action": "Follow up with {{participant_name}} via email about parent/teacher form issue",
            "status": "pending"
          },
          {
            "owner": "{{meeting_owner}}",
            "action": "Attend 12/3 meeting with Dr. Ortiz and John to answer platform questions",
            "status": "pending"
          },
          {
            "owner": "{{participant_name}}",
            "action": "Send list of feedback points from team",
            "status": "pending"
          },
          {
            "owner": "{{participant_name}}",
            "action": "Connect with {{participant_name}} on rescheduling",
            "status": "pending"
          }
        ]
      },

      "next_meeting": {
        "date": "{{next_meeting_date}}",
        "purpose": "What will be covered",
        "attendees": "Who should be there"
      }
    }
  },

  "followup_email_template": {
    "subject": {
      "suggested": "Great connecting - {{district_name}} check-in recap",
      "alternatives": [
        "Following up from our {{meeting_type}} call",
        "{{district_name}} partnership update + next steps"
      ]
    },

    "greeting": {
      "format": "Hi {{participant_names}}!"
    },

    "opening": {
      "template": "It was great connecting {{meeting_timeframe}}! {{personalized_detail}}",
      "personalized_detail_examples": [
        "Good luck to your son at grand championships this weekend!",
        "Hope the garage stays organized!",
        "Congrats again on winning the holiday door decorating contest!"
      ]
    },

    "body_sections": {
      "summary": {
        "template": "I wanted to recap what we discussed and outline next steps:",
        "notes": "Brief, scannable summary of key discussion points"
      },

      "feedback_acknowledgment": {
        "template": "Thank you for sharing the team's feedback on {{topics}}. I've logged the following items with our product team:",
        "format_items_as": "Bulleted list of specific issues/requests acknowledged"
      },

      "action_items": {
        "header": "Action Items",
        "format": {
          "marker_actions": "What {{meeting_owner}}/Marker team will do",
          "customer_actions": "What {{participant_name}}/customer team will do"
        }
      },

      "resources": {
        "optional": true,
        "examples": [
          "Recording link: {{recording_url}}",
          "Presentation deck: {{deck_url}}",
          "Help article on {{topic}}: {{help_url}}"
        ]
      }
    },

    "closing": {
      "next_meeting": "Looking forward to our next check-in on {{next_meeting_date}}!",
      "questions_prompt": "Please don't hesitate to reach out if anything comes up before then.",
      "signature": "{{meeting_owner}}"
    }
  },

  "feature_request_ticket": {
    "fields": {
      "title": {
        "format": "[Feature Request] {{brief_description}}",
        "examples": [
          "[Feature Request] Post-HS grade dropdown for transition programs",
          "[Feature Request] Admin usage dashboard",
          "[Feature Request] Multi-assessment PDF upload"
        ]
      },
      "source": {
        "type": "object",
        "fields": {
          "customer": "{{district_name}}",
          "contact": "{{participant_name}}",
          "meeting_date": "{{date}}",
          "hubspot_link": "Link to CRM record"
        }
      },
      "description": {
        "template": "**Request:** {{detailed_description}}\n\n**Context:** {{why_they_need_it}}\n\n**Use Case:** {{specific_scenario}}\n\n**Customer Quote:** \"{{direct_quote_if_available}}\""
      },
      "priority": {
        "type": "select",
        "options": ["P0 - Critical", "P1 - High", "P2 - Medium", "P3 - Low"],
        "guidance": {
          "P0": "Blocking adoption or causing churn risk",
          "P1": "Requested by multiple customers or key accounts",
          "P2": "Would improve experience for specific use cases",
          "P3": "Nice to have, single customer request"
        }
      },
      "customer_impact": {
        "fields": {
          "accounts_requesting": "Number of customers who have asked",
          "users_affected": "Estimated user count",
          "revenue_at_risk": "If applicable"
        }
      },
      "labels": {
        "type": "multi-select",
        "options": [
          "assessment-support",
          "ui-ux",
          "integrations",
          "reporting",
          "admin-tools",
          "workflow",
          "data-accuracy",
          "accessibility"
        ]
      }
    }
  },

  "bug_report_ticket": {
    "fields": {
      "title": {
        "format": "[Bug] {{brief_description}}",
        "examples": [
          "[Bug] Gender incorrect in KABC report output",
          "[Bug] Rating scales overwriting previous edits",
          "[Bug] Edits not saving for user"
        ]
      },
      "source": {
        "customer": "{{district_name}}",
        "reporter": "{{participant_name}}",
        "report_date": "{{date}}"
      },
      "description": {
        "template": "**Issue:** {{what_happened}}\n\n**Expected:** {{what_should_happen}}\n\n**Steps to Reproduce:**\n1. {{step_1}}\n2. {{step_2}}\n\n**Workaround:** {{if_available}}"
      },
      "severity": {
        "type": "select",
        "options": ["Critical", "High", "Medium", "Low"],
        "guidance": {
          "Critical": "Platform unusable, data loss, or security issue",
          "High": "Major feature broken, no workaround",
          "Medium": "Feature impaired but workaround exists",
          "Low": "Minor issue, cosmetic, or edge case"
        }
      },
      "attachments": {
        "notes": "Include screenshots from customer if provided"
      }
    }
  },

  "checklist_after_meeting": [
    "Update HubSpot with meeting notes",
    "Add/update recording link in CRM",
    "Send follow-up email within 24 hours",
    "Create tickets for any feature requests",
    "Create tickets for any bugs reported",
    "Update key user/influencer notes if new info shared",
    "Schedule next meeting if not already on calendar",
    "Flag any churn risks to leadership",
    "Update success metrics tracking if baselines shared"
  ]
}

---

## Implementation Status

### Completed Features (as of Dec 2024)

#### 1. Database Schema
- **Migrations 001-008**: Core tables for customers, meetings, extracts, tags, email drafts, plus host_name and host_email fields
- **Customer Types**: Support for `deal` vs `customer` distinction with HubSpot company/deal IDs
- **Extract Participant Fields**: `participant_name` and `participant_email` on extracts
- **Email Drafts Table**: Full CRUD for email draft generation and management

#### 2. Meeting Detail Page Features
- **Meeting Type Badge**: Shows "Deal" or "Customer" based on linked customer type
- **Host Information**: Display and edit host name and email in the edit modal
- **Collapsible Transcript**: Transcript section is collapsed by default, expandable
- **Extracts in Main Column**: Extracts displayed prominently above transcript
- **Workflow Actions Panel**: Unified list of workflow actions in right column

#### 3. Workflow Actions (Right Sidebar)
All workflow actions are now consolidated in the "Workflow Actions" panel:
- **Generate Follow-up Email**: Creates email drafts using appropriate template (deal vs customer)
- **Generate Meeting Notes**: Generates summary from extracts and adds to meeting's Notes field (not email draft)
- **Write Notes to HubSpot**: Generates CRM notes and syncs to HubSpot (requires linked company/deal)
- **Create Linear Tickets**: Creates feature request and/or bug tickets (customer meetings only)

#### 4. Email Generation
- Consolidated to single "Generate Follow-up Email" action
- Automatically uses correct template based on meeting type:
  - **Deal meetings**: Sales follow-up with next steps, pilot details, ROI calculations
  - **Customer meetings**: Recap with feedback acknowledgment, action items, and resource links
- Drafts stored in email_drafts table, displayed in Email Drafts panel

#### 5. Meeting Notes Generation
- New `/api/meetings/[id]/generate-notes` endpoint
- Generates structured notes summary from extracts
- Adds to meeting's `user_notes` field (appends if existing notes present)
- Sections include: Summary, Key Discussion Points, Decisions Made, Action Items, Next Steps

#### 6. CRM Integration (HubSpot)
- Generate comprehensive CRM notes including:
  - Meeting summary
  - Relationship and professional context
  - Success metrics
  - Platform feedback (positive/negative/neutral)
  - Feature requests (with priority P0-P3)
  - Bugs and issues (with severity)
  - Action items with owners
- Write notes to HubSpot companies or deals via engagement API

#### 7. Linear Integration
- Create feature request tickets with:
  - Customer context and HubSpot link
  - Priority and labels
  - User quotes and contact info
- Create bug report tickets with:
  - Issue description and severity
  - Steps to reproduce and workarounds
  - Customer and reporter info

#### 8. UI/UX Improvements
- Edit modal includes: Name, Date/Time, Host Name, Host Email, Customer/Company (with type badge), Notes
- Meeting details show: Date, Host, Customer with type badge, Source, Transcript Source, Status
- Responsive layout with main content (2 columns) and sidebar (1 column)

### Files Modified/Created

#### Core Components
- `app/meetings/[id]/page.tsx` - Meeting detail page with reorganized layout
- `app/meetings/[id]/workflow-actions.tsx` - Unified workflow actions component
- `app/meetings/[id]/meeting-actions.tsx` - Edit modal with host fields
- `app/meetings/[id]/collapsible-transcript.tsx` - Collapsible transcript component

#### API Routes
- `app/api/meetings/[id]/generate-notes/route.ts` - Generate meeting notes summary
- `app/api/meetings/[id]/generate-email/route.ts` - Generate email drafts
- `app/api/hubspot/write-notes/route.ts` - Write CRM notes to HubSpot
- `app/api/linear/create-tickets/route.ts` - Create Linear tickets

#### Libraries
- `lib/gemini/email-generation.ts` - Email and notes generation with templates
- `lib/hubspot/notes.ts` - HubSpot notes API integration
- `lib/linear/tickets.ts` - Linear ticket creation
- `lib/email/mailgun.ts` - Mailgun email sending (for notifications)

### Environment Variables Required
```
DATABASE_URL=postgres://...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
HUBSPOT_ACCESS_TOKEN=...
LINEAR_API_KEY=...
MAILGUN_API_KEY=...
MAILGUN_DOMAIN=...
GEMINI_API_KEY=...
```

---

## Phase: Per-User Zoom OAuth 2.0 Integration

### Overview
Enable each authenticated user to connect their Zoom account via OAuth 2.0 (similar to Google), which can then be used to import their meetings, recordings, and transcripts. The Zoom sync option should be disabled if no Zoom account is connected for the current user.

### Requirements
1. **OAuth 2.0 Flow**: Users click "Connect Zoom" and authorize via Zoom login (like Google)
2. **Per-User Token Storage**: Store access_token and refresh_token per user (plaintext)
3. **Settings Modal**: Accessible from avatar menu to connect/disconnect Zoom
4. **Conditional UI**: Zoom sync option disabled when user hasn't connected Zoom
5. **14-Day Sync**: Import last 14 days of meetings on sync
6. **Duplicate Detection**: Skip meetings that already exist from Google Meet or HubSpot (by time proximity)
7. **Content Priority**: Transcript > Recording > Prompt user for meetings with neither

### Environment Variables Required
```
ZOOM_CLIENT_ID=...          # OAuth app client ID from Zoom Marketplace
ZOOM_CLIENT_SECRET=...      # OAuth app client secret from Zoom Marketplace
ZOOM_REDIRECT_URI=...       # e.g., https://yourapp.com/api/auth/zoom/callback
```

---

### Migration 009: Per-User Zoom OAuth Tokens
**File:** `db/migrations/009_user_zoom_oauth_tokens.sql`

```sql
-- Add Zoom OAuth 2.0 tokens per user (similar to Google tokens)
ALTER TABLE users
ADD COLUMN zoom_access_token TEXT,
ADD COLUMN zoom_refresh_token TEXT,
ADD COLUMN zoom_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN zoom_user_id VARCHAR(255);

-- Index for checking if user has Zoom connected
CREATE INDEX idx_users_zoom_connected ON users(id) WHERE zoom_access_token IS NOT NULL;

COMMENT ON COLUMN users.zoom_access_token IS 'Zoom OAuth 2.0 access token';
COMMENT ON COLUMN users.zoom_refresh_token IS 'Zoom OAuth 2.0 refresh token';
COMMENT ON COLUMN users.zoom_token_expires_at IS 'When the access token expires';
COMMENT ON COLUMN users.zoom_user_id IS 'Zoom user ID for the connected account';
```

---

### TypeScript Type Updates
**File:** `lib/db/types.ts`

Add to User interface:
```typescript
export interface User {
  // ... existing fields ...
  zoom_access_token: string | null;
  zoom_refresh_token: string | null;
  zoom_token_expires_at: Date | null;
  zoom_user_id: string | null;
}
```

---

### Database Functions
**File:** `lib/db/users.ts`

Add functions:
```typescript
// Check if user has Zoom connected
export async function hasZoomConnected(userId: string): Promise<boolean>

// Get user's Zoom tokens (for use by Zoom client)
export async function getUserZoomTokens(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  zoomUserId: string;
} | null>

// Save/update user's Zoom OAuth tokens
export async function updateUserZoomTokens(
  userId: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date,
  zoomUserId: string
): Promise<void>

// Clear user's Zoom connection (disconnect)
export async function disconnectUserZoom(userId: string): Promise<void>
```

---

### Zoom OAuth Client
**File:** `lib/zoom/oauth.ts`

New file for OAuth 2.0 flow:
```typescript
// Build Zoom OAuth authorization URL
export function getZoomAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.ZOOM_CLIENT_ID!,
    redirect_uri: process.env.ZOOM_REDIRECT_URI!,
    state: state,
  });
  return `https://zoom.us/oauth/authorize?${params}`;
}

// Exchange authorization code for tokens
export async function exchangeZoomCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}>

// Refresh expired access token
export async function refreshZoomToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}>

// Get Zoom user info from token
export async function getZoomUserInfo(accessToken: string): Promise<{
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}>
```

---

### Zoom Client Updates
**File:** `lib/zoom/client.ts`

Modify to support per-user OAuth tokens:
```typescript
// Keep existing env-based functions for backward compatibility (admin use)
export function isZoomConfigured(): boolean  // Check env vars

// Add per-user OAuth functions
export async function isUserZoomConnected(userId: string): Promise<boolean>

export async function getUserZoomAccessToken(userId: string): Promise<string>
// Gets user's access token, refreshing if expired
// Auto-updates stored tokens when refreshed

export async function userZoomRequest<T>(
  userId: string,
  endpoint: string,
  options?: RequestOptions
): Promise<T>
// Makes authenticated request using user's tokens
```

---

### API Routes

#### Zoom OAuth Routes
**File:** `app/api/auth/zoom/route.ts`

```typescript
// GET: Initiates Zoom OAuth flow
// - Generates state token (stores in session/cookie)
// - Redirects to Zoom authorization URL
```

**File:** `app/api/auth/zoom/callback/route.ts`

```typescript
// GET: Zoom OAuth callback handler
// - Validates state token
// - Exchanges code for tokens
// - Gets Zoom user info
// - Stores tokens in database
// - Redirects to settings with success message
```

#### Zoom Connection Status & Disconnect
**File:** `app/api/user/zoom-status/route.ts`

```typescript
// GET: Returns { connected: boolean, email?: string } for current user
// DELETE: Disconnects Zoom (clears tokens)
```

#### Updated Zoom Sync API
**File:** `app/api/meetings/sync-zoom/route.ts`

Update to:
1. Use authenticated user's OAuth tokens instead of env vars
2. Default to 14 days instead of 30
3. Check for time-based duplicates across all sources
4. Return meetings needing user decision (no transcript or recording)

```typescript
export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

  // Check user has Zoom connected
  if (!await isUserZoomConnected(userId)) {
    return NextResponse.json({ error: "Zoom not connected" }, { status: 400 });
  }

  const { days = 14, skipExternalIds = [], importWithoutTranscript = [] } = await request.json();

  // Fetch meetings using user's OAuth tokens
  const zoomMeetings = await fetchUserZoomRecordings(userId, days);

  // Filter out duplicates by time proximity (within 30 mins of existing meeting)
  // Return: { synced, skipped, needsDecision: [...] }
}
```

---

### UI Components

#### Settings Modal
**File:** `components/settings-modal.tsx`

```typescript
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  // Sections for different integrations
  // Zoom section with:
  //   - Status: "Connected as user@email.com" or "Not connected"
  //   - "Connect Zoom" button (redirects to OAuth flow)
  //   - "Disconnect" button (if connected)
  //   - Brief explanation of what connecting enables
}
```

#### Updated User Menu
**File:** `components/user-menu.tsx`

Add Settings option:
```typescript
<button onClick={() => setShowSettings(true)}>
  <SettingsIcon /> Settings
</button>

{showSettings && (
  <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
)}
```

#### Updated Sync Button
**File:** `app/meetings/sync-button.tsx`

Modify to:
1. Fetch user's Zoom connection status on mount
2. Disable Zoom option if not connected
3. Show tooltip explaining why disabled ("Connect Zoom in Settings")
4. Handle "needs decision" response for meetings without transcript

```typescript
const [zoomConnected, setZoomConnected] = useState<boolean | null>(null);

useEffect(() => {
  fetch('/api/user/zoom-status')
    .then(res => res.json())
    .then(data => setZoomConnected(data.connected));
}, []);

// In dropdown:
<button
  disabled={!zoomConnected}
  title={!zoomConnected ? "Connect Zoom in Settings first" : undefined}
>
  Zoom
</button>
```

#### Import Decision Modal
**File:** `app/meetings/import-decision-modal.tsx`

For meetings without transcript or recording (user prompted each time):
```typescript
interface ImportDecisionModalProps {
  meetings: Array<{
    id: string;
    name: string;
    date: Date;
    hasRecording: boolean;
    hasTranscript: boolean;
  }>;
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
}

// Shows list of meetings without transcripts
// Explains: "These meetings have no transcript or recording available"
// Checkboxes to select which to import anyway (metadata only)
// "Import Selected" and "Skip All" buttons
```

---

### Zoom Meeting Sync Logic Updates
**File:** `lib/zoom/meetings.ts`

Add/modify functions:
```typescript
// Fetch recordings using per-user OAuth tokens
export async function fetchUserZoomRecordings(
  userId: string,
  days: number = 14
): Promise<ZoomMeetingWithRecordings[]>

// Check for duplicate meetings across sources (time-based)
export async function findDuplicateMeeting(
  meetingDate: Date,
  meetingName: string,
  windowMinutes: number = 30
): Promise<Meeting | null>

// Enhanced sync that handles transcript priority
export async function syncZoomMeetingWithPriority(
  userId: string,
  meeting: ZoomMeetingWithRecordings
): Promise<{
  status: 'synced' | 'duplicate' | 'needs_decision';
  meeting?: Meeting;
  reason?: string;
}>
```

---

### Implementation Order

1. **Database migration** (009_user_zoom_oauth_tokens.sql)
2. **Type updates** (lib/db/types.ts - Zoom token fields)
3. **Database functions** (lib/db/users.ts - Zoom token functions)
4. **Zoom OAuth module** (lib/zoom/oauth.ts - OAuth flow helpers)
5. **Zoom client updates** (lib/zoom/client.ts - per-user token auth)
6. **OAuth API routes** (api/auth/zoom, api/auth/zoom/callback)
7. **Zoom status API** (api/user/zoom-status)
8. **Settings modal component** (components/settings-modal.tsx)
9. **User menu update** (add Settings option)
10. **Sync button updates** (conditional Zoom enable)
11. **Import decision modal** (for meetings without transcript)
12. **Zoom sync logic** (14 days, duplicates, priority)
13. **Updated sync-zoom API** (use user OAuth tokens)

---

### Zoom App Setup Requirements

To use this integration, you'll need to create a Zoom OAuth app:

1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/)
2. Click "Develop" → "Build App"
3. Choose "OAuth" app type
4. Configure:
   - App Name: "Qualitative Meetings"
   - Redirect URL: `https://yourapp.com/api/auth/zoom/callback`
   - Scopes required:
     - `user:read` - Read user profile
     - `meeting:read` - Read meeting details
     - `recording:read` - Read cloud recordings
5. Copy Client ID and Client Secret to environment variables

---

### Files to Create
- `db/migrations/009_user_zoom_oauth_tokens.sql`
- `lib/zoom/oauth.ts`
- `app/api/auth/zoom/route.ts`
- `app/api/auth/zoom/callback/route.ts`
- `app/api/user/zoom-status/route.ts`
- `components/settings-modal.tsx`
- `app/meetings/import-decision-modal.tsx`

### Files to Modify
- `lib/db/types.ts` - Add Zoom OAuth token fields to User
- `lib/db/users.ts` - Add Zoom token management functions
- `lib/zoom/client.ts` - Add per-user OAuth token authentication
- `lib/zoom/meetings.ts` - Add duplicate detection, priority sync, user-based fetching
- `app/api/meetings/sync-zoom/route.ts` - Use user OAuth tokens, 14 days default
- `components/user-menu.tsx` - Add Settings option
- `app/meetings/sync-button.tsx` - Conditional Zoom enable based on connection status

---

## Phase: Configurable Sync Period

### Overview
Allow users to configure how many days back to sync meetings from all sources (Google Meet, HubSpot, Zoom, Teams). This setting is stored per-user and can be changed in the Settings modal.

### Implementation Status: COMPLETED

### Migration 010: Sync Days Preference
**Applied directly to database:**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS sync_days_preference INTEGER DEFAULT 14;
```

### TypeScript Type Updates
**File:** `lib/db/types.ts`

Added to User interface:
```typescript
export interface User {
  // ... existing fields ...
  sync_days_preference: number;
}
```

### Database Functions
**File:** `lib/db/users.ts`

Added functions:
```typescript
// Get user's sync days preference (default: 14)
export async function getUserSyncDaysPreference(userId: string): Promise<number>

// Update user's sync days preference (clamped 1-90)
export async function updateUserSyncDaysPreference(userId: string, days: number): Promise<number>
```

### API Endpoint
**File:** `app/api/user/preferences/route.ts`

```typescript
// GET /api/user/preferences
// Returns: { syncDays: number }

// PATCH /api/user/preferences
// Body: { syncDays?: number }
// Returns: { syncDays: number }
```

### UI Updates

#### Settings Modal
**File:** `components/settings-modal.tsx`

Added "Sync Preferences" section:
- Number input for sync days (1-90)
- Save button with loading state
- Success/error feedback
- Description: "This setting applies to Google Meet, HubSpot, Zoom, and Teams sync."

#### Sync Button
**File:** `app/meetings/sync-button.tsx`

Updates:
- Fetches user's sync days preference on mount
- Uses preference for all sync sources (replaces hardcoded 7/14 days)
- Displays "Last X days" in dropdown menu dynamically based on preference

### Configuration
- **Default value**: 14 days
- **Minimum**: 1 day
- **Maximum**: 90 days
- **Applies to**: Google Meet, HubSpot, Zoom, and Microsoft Teams sync

---

## Phase: User-Customizable Prompt Templates & Notifications

### Overview
Allow users to customize the AI prompts used for generating email drafts and meeting notes. Each user can have their own templates that override the system defaults. Additionally, users can configure email notifications to be sent automatically when drafts or notes are created.

### Implementation Status: COMPLETED

### Migration 015: User Prompt Templates and Notification Preferences
**File:** `db/migrations/015_user_prompt_templates.sql`

```sql
-- User-customizable prompt templates
ALTER TABLE users ADD COLUMN IF NOT EXISTS deal_email_prompt_template TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_email_prompt_template TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes_prompt_template TEXT;

-- Notification preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_meeting_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_draft_created BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_notes_created BOOLEAN DEFAULT FALSE;
```

### TypeScript Type Updates
**File:** `lib/db/types.ts`

Added to User interface:
```typescript
export interface User {
  // ... existing fields ...
  deal_email_prompt_template: string | null;
  customer_email_prompt_template: string | null;
  notes_prompt_template: string | null;
  notification_email: string | null;
  notify_on_meeting_processed: boolean;
  notify_on_draft_created: boolean;
  notify_on_notes_created: boolean;
}
```

### Database Functions
**File:** `lib/db/users.ts`

Added functions:
```typescript
// Get user's custom prompt templates
export async function getUserPromptTemplates(userId: string): Promise<{
  deal_email_prompt_template: string | null;
  customer_email_prompt_template: string | null;
  notes_prompt_template: string | null;
}>

// Update a specific prompt template
export async function updateUserPromptTemplate(
  userId: string,
  templateType: 'deal_email' | 'customer_email' | 'notes',
  template: string | null
): Promise<void>

// Get user's notification preferences
export async function getUserNotificationPrefs(userId: string): Promise<{
  notification_email: string | null;
  notify_on_meeting_processed: boolean;
  notify_on_draft_created: boolean;
  notify_on_notes_created: boolean;
}>

// Update notification preferences
export async function updateUserNotificationPrefs(
  userId: string,
  prefs: Partial<NotificationPrefs>
): Promise<void>
```

### Generation Functions Updates
**File:** `lib/gemini/email-generation.ts`

- Exported default prompts as constants for UI display:
  - `DEFAULT_DEAL_EMAIL_PROMPT`
  - `DEFAULT_CUSTOMER_EMAIL_PROMPT`
  - `DEFAULT_NOTES_PROMPT`
- Updated generation functions to accept optional custom prompts:
  - `generateFollowUpEmail(..., customPrompt?: string)`
  - `generateMeetingNotesSummary(..., customPrompt?: string)`

### API Endpoints

#### Prompt Templates API
**File:** `app/api/user/prompt-templates/route.ts`

```typescript
// GET: Returns user's custom templates + defaults
// Response: { templates: {...}, defaults: {...} }

// PATCH: Update a specific template
// Body: { templateType: 'deal_email' | 'customer_email' | 'notes', template: string }

// DELETE: Reset a template to default (sets to null)
// Body: { templateType: 'deal_email' | 'customer_email' | 'notes' }
```

#### Preferences API (Extended)
**File:** `app/api/user/preferences/route.ts`

Extended to include notification preferences:
```typescript
// GET: Returns { syncDays, notificationEmail, notifyOnDraftCreated, notifyOnNotesCreated, ... }
// PATCH: Updates any preference including notifications
```

#### Generate Email API (Updated)
**File:** `app/api/meetings/[id]/generate-email/route.ts`

- Fetches user's custom prompt template before generating
- Passes custom prompt to generation function
- Sends email notification if user has enabled `notify_on_draft_created`

#### Generate Notes API (Updated)
**File:** `app/api/meetings/[id]/generate-notes/route.ts`

- Fetches user's custom notes prompt template before generating
- Passes custom prompt to generation function
- Sends email notification if user has enabled `notify_on_notes_created`

### Email Notifications
**File:** `lib/email/notifications.ts`

Added notification functions:
```typescript
// Notify user when email drafts are ready
export async function sendDraftReadyNotification(
  hostEmail: string,
  meeting: Meeting,
  customer: Customer | null,
  drafts: EmailDraft[]
): Promise<NotificationResult>

// Notify user when meeting notes are ready
export async function sendNotesReadyNotification(
  toEmail: string,
  meeting: Meeting,
  customer: Customer | null,
  notes: string
): Promise<NotificationResult>
```

### UI Components

#### Settings Modal (Major Update)
**File:** `components/settings-modal.tsx`

Reorganized with tabbed interface:
1. **Integrations Tab**: Zoom connection, sync preferences
2. **Prompt Templates Tab**: Edit custom prompts for:
   - Deal follow-up emails
   - Customer follow-up emails
   - Meeting notes
   - Each with Save and Reset to Default buttons
3. **Notifications Tab**: Configure email notifications:
   - Notification email address (defaults to account email)
   - Toggle: Notify when email drafts are created
   - Toggle: Notify when meeting notes are created

#### Meeting Detail Page Updates

**Email Draft Panel** (`app/meetings/[id]/email-draft-panel.tsx`):
- Added "Edit Template" button next to Regenerate
- Opens Settings modal to Prompt Templates tab

**Editable Notes** (`app/meetings/[id]/editable-notes.tsx`):
- Added "Regenerate" button for regenerating notes from extracts
- Added "Edit Template" button
- Opens Settings modal to Prompt Templates tab

### Feature Summary

| Feature | Description |
|---------|-------------|
| Custom Deal Email Prompt | User-customizable prompt for deal follow-up emails |
| Custom Customer Email Prompt | User-customizable prompt for customer follow-up emails |
| Custom Notes Prompt | User-customizable prompt for meeting notes generation |
| Reset to Default | One-click reset of any prompt to system default |
| Draft Created Notification | Email notification when email drafts are generated |
| Notes Created Notification | Email notification when meeting notes are generated |
| Custom Notification Email | Send notifications to different email than account |
| Edit Template Button | Quick access to edit prompts from meeting detail page |
| Regenerate Notes | Re-generate notes using current extracts |

---

## Phase: Extracts Page Optimization

### Overview
Optimized the extracts page to handle large datasets with improved performance and pagination support.

### Implementation Status: COMPLETED

### Database Functions
**File:** `lib/db/extracts.ts`

Added optimized paginated query:
```typescript
export async function getExtractsWithDetailsPaginated(
  params: PaginatedExtractsParams = {}
): Promise<PaginatedExtractsResult>
```

Key optimizations:
- Single SQL query with JOINs instead of N+1 queries
- Returns extracts with meeting, customer, tags, and rule data in one call
- Supports pagination with limit/offset
- Filters: customerId, ruleId, tagId, isActionItem, search

### API Route Updates
**File:** `app/extracts/page.tsx`

- Added `export const maxDuration = 60` for extended Vercel timeout
- Uses optimized `getExtractsWithDetailsPaginated()` function
- Reduced query count from 50+ to 4 parallel queries

### URL-Based Filtering
**File:** `app/extracts/extracts-filter.tsx`

Added URL parameter support:
- `?filter=action` - Shows only action items
- `?filter=request` - Shows only feature requests (non-action items)
- Enables deep linking from other pages

---

## Phase: Activity Summary Improvements

### Overview
Improved the recent activity summaries on the dashboard to show limited items with navigation links to the full extracts list.

### Implementation Status: COMPLETED

### Component Updates
**File:** `app/recent-activity.tsx`

Changes:
- Limited activity items to 5 per type (actions and requests)
- Added "See all X actions" link → `/extracts?filter=action`
- Added "See all X requests" link → `/extracts?filter=request`
- Better visual separation between action items and feature requests

### User Experience
- Dashboard shows quick overview without overwhelming data
- One-click navigation to filtered extracts list
- Counts show total available vs. displayed items