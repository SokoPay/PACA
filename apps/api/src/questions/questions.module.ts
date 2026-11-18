import { Module } from "@nestjs/common";
import { ReviewController } from "./review.controller";
import { ReviewService } from "./review.service";
import { QuestionBankController } from "./question-bank.controller";
import { QuestionGeneratorService } from "./question-generator.service";
import { QuestionBankImportService } from "./question-bank-import.service";

@Module({
  controllers: [ReviewController, QuestionBankController],
  providers: [ReviewService, QuestionGeneratorService, QuestionBankImportService],
})
export class QuestionsModule {}
