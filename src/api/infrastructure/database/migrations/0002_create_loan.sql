CREATE TABLE "loan" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"id" uuid PRIMARY KEY NOT NULL,
	"book_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"loaned_on" date NOT NULL,
	"due_on" date NOT NULL,
	"returned_on" date
);
