CREATE TABLE "book" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"id" uuid PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"title" varchar(255) NOT NULL,
	"author" varchar(255) NOT NULL
);
