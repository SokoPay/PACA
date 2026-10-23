import { Controller, Get } from "@nestjs/common";
import { PublicContentService } from "./public-content.service";
import { Public } from "../common/decorators/public.decorator";

/**
 * All public — no membership required to browse courses, partners, the library,
 * FAQ, jobs, or the opted-in member directory. One controller per route prefix,
 * sharing a single service since each is just a read-only list query.
 */
@Public()
@Controller("courses")
export class CoursesController {
  constructor(private readonly content: PublicContentService) {}
  @Get() list() {
    return this.content.courses();
  }
}

@Public()
@Controller("partners")
export class PartnersController {
  constructor(private readonly content: PublicContentService) {}
  @Get() list() {
    return this.content.partners();
  }
}

@Public()
@Controller("resources")
export class ResourcesController {
  constructor(private readonly content: PublicContentService) {}
  @Get() list() {
    return this.content.resources();
  }
}

@Public()
@Controller("faq")
export class FaqController {
  constructor(private readonly content: PublicContentService) {}
  @Get() list() {
    return this.content.faq();
  }
}

@Public()
@Controller("jobs")
export class JobsController {
  constructor(private readonly content: PublicContentService) {}
  @Get() list() {
    return this.content.jobs();
  }
}

@Public()
@Controller("directory")
export class DirectoryController {
  constructor(private readonly content: PublicContentService) {}
  @Get() list() {
    return this.content.directory();
  }
}
