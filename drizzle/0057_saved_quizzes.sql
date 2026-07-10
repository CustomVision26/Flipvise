CREATE TABLE IF NOT EXISTS "saved_quizzes" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" varchar(255) NOT NULL,
  "team_id" integer REFERENCES "teams"("id") ON DELETE SET NULL,
  "quiz_result_id" integer REFERENCES "quiz_results"("id") ON DELETE SET NULL,
  "deck_id" integer REFERENCES "decks"("id") ON DELETE SET NULL,
  "label" varchar(255) NOT NULL,
  "title" varchar(512) NOT NULL,
  "subject" varchar(255) NOT NULL,
  "grade_level" varchar(64) NOT NULL,
  "source_deck_name" varchar(255) NOT NULL,
  "member_label" varchar(255),
  "member_email" varchar(255),
  "per_card" json NOT NULL,
  "question_sheet_pdf_url" text,
  "question_sheet_pdf_file_name" varchar(255),
  "answer_key_pdf_url" text,
  "answer_key_pdf_file_name" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "saved_quizzes_user_id_idx" ON "saved_quizzes" ("user_id");
