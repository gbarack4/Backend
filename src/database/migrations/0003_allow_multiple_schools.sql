DROP INDEX "idx_school_domains_domain";--> statement-breakpoint
ALTER TABLE "school_domains" ADD CONSTRAINT "school_domains_domain_key" UNIQUE("domain");--> statement-breakpoint
ALTER TABLE "website_templates" ADD CONSTRAINT "website_templates_name_key" UNIQUE("name");