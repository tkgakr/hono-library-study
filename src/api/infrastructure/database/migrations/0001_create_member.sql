CREATE TABLE "member" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"id" uuid PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL
);
