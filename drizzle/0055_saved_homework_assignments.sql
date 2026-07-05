CREATE TABLE "saved_homework_assignments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "saved_homework_assignments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" varchar(255) NOT NULL,
	"label" varchar(255) NOT NULL,
	"assignmentTitle" varchar(512) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"gradeLevel" varchar(64) NOT NULL,
	"topic" varchar(255) NOT NULL,
	"difficultyLevel" varchar(32) NOT NULL,
	"sourceType" varchar(32) NOT NULL,
	"savedLessonPlanId" integer,
	"sourceLessonPlanTitle" varchar(512),
	"deckId" integer,
	"sourceDeckName" varchar(255),
	"input" json NOT NULL,
	"result" json NOT NULL,
	"pdfUrl" text,
	"pdfFileName" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "saved_homework_assignments_user_id_idx" ON "saved_homework_assignments" USING btree ("userId");
