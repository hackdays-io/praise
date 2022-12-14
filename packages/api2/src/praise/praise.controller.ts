import {
  BadRequestException,
  Body,
  ClassSerializerInterceptor,
  Controller,
  Get,
  Param,
  Query,
  Req,
  SerializeOptions,
  UseInterceptors,
} from '@nestjs/common';
import { ApiParam } from '@nestjs/swagger';
import { isArray } from 'class-validator';
import { Response } from 'express';
import { Types } from 'mongoose';
import { ObjectIdPipe } from '@/shared/pipes/object-id.pipe';
import { PraiseQuantificationCreateUpdateInput } from './intefaces/praise-quantification-input.interface';
import { PraiseQuantifyMultiplePraiseInput } from './intefaces/praise-quantify-multiple-input.interface';
import { PraiseService } from './praise.service';
import { Praise } from './schemas/praise.schema';
import { FindAllPraisePaginatedQuery } from './dto/find-all-praise-paginated-query.dto';
import { PaginationModel } from 'mongoose-paginate-ts';

@Controller('praise')
@SerializeOptions({
  excludePrefixes: ['__'],
})
@UseInterceptors(ClassSerializerInterceptor)
// @UseGuards(JwtAuthGuard)
export class PraiseController {
  constructor(private readonly praiseService: PraiseService) {}

  @Get()
  async findAllPaginated(
    @Query() options: FindAllPraisePaginatedQuery,
  ): Promise<PaginationModel<Praise>> {
    return this.praiseService.findAllPaginated(options);
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  async findOne(
    @Param('id', ObjectIdPipe) id: Types.ObjectId,
  ): Promise<Praise> {
    return this.praiseService.findOneById(id);
  }

  @Get(':id/quantify')
  @ApiParam({ name: 'id', type: String })
  async quantify(
    @Param('id', ObjectIdPipe) id: Types.ObjectId,
    @Body() data: PraiseQuantificationCreateUpdateInput,
    @Req() res: Response,
  ): Promise<Praise[]> {
    return this.praiseService.quantifyPraise({
      id: id.toString(),
      bodyParams: data,
      currentUser: res.locals.currentUser,
    });
  }

  @Get('quantify')
  async quantifyMultiple(
    @Body() data: PraiseQuantifyMultiplePraiseInput,
    @Req() res: Response,
  ): Promise<Praise[]> {
    const { praiseIds } = data;

    if (!isArray(praiseIds)) {
      throw new BadRequestException('praiseIds must be an array');
    }

    const praiseItems = await Promise.all(
      praiseIds.map(async (id) => {
        const affectedPraises = await this.praiseService.quantifyPraise({
          id,
          bodyParams: data,
          currentUser: res.locals.currentUser,
        });

        return affectedPraises;
      }),
    );

    return praiseItems.flat();
  }
}
