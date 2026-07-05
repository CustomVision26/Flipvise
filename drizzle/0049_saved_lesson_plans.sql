CREATE TABLE "saved_lesson_plans" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "saved_lesson_plans_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" varchar(255) NOT NULL,
	"lessonTitle" varchar(512) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"gradeLevel" varchar(64) NOT NULL,
	"topic" varchar(255) NOT NULL,
	"difficultyLevel" varchar(32) NOT NULL,
	"input" json NOT NULL,
	"result" json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "saved_lesson_plans_user_id_idx" ON "saved_lesson_plans" USING btree ("userId");
