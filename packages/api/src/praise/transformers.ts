import { userAccountTransformer } from '@useraccount/transformers';
import {
  PraiseDocument,
  PraiseDto,
  Quantification,
  QuantificationDto,
} from './types';
import {
  calculateQuantificationDuplicateScore,
  calculateQuantificationsCompositeScore,
} from './utils/score';

const quantificationToDto = async (
  quantification: Quantification
): Promise<QuantificationDto> => {
  const {
    quantifier,
    score,
    dismissed,
    duplicatePraise,
    createdAt,
    updatedAt,
    completed,
  } = quantification;

  const duplicateScore = await calculateQuantificationDuplicateScore(
    quantification
  );

  return {
    quantifier: quantifier._id,
    score,
    dismissed,
    duplicatePraise: duplicatePraise ? duplicatePraise._id : undefined,
    duplicateScore,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    completed,
  };
};

export const quantificationListTransformer = async (
  quantifications: Quantification[] | Quantification | undefined
): Promise<QuantificationDto[]> => {
  if (quantifications) {
    if (Array.isArray(quantifications)) {
      const quantificationDto: QuantificationDto[] = [];
      for (const q of quantifications) {
        quantificationDto.push(await quantificationToDto(q));
      }
      return quantificationDto;
    } else {
      return [await quantificationToDto(quantifications)];
    }
  }
  return [];
};

const praiseDocumentToDto = async (
  praiseDocument: PraiseDocument
): Promise<PraiseDto> => {
  const {
    _id,
    reason,
    sourceId,
    sourceName,
    quantifications,
    giver,
    receiver,
    forwarder,
    createdAt,
    updatedAt,
  } = praiseDocument;
  return {
    _id,
    reason,
    sourceId,
    sourceName,
    quantifications: await quantificationListTransformer(quantifications),
    giver: userAccountTransformer(giver),
    receiver: userAccountTransformer(receiver),
    forwarder: forwarder ? userAccountTransformer(forwarder) : undefined,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
    scoreRealized: await calculateQuantificationsCompositeScore(
      praiseDocument.quantifications
    ),
  };
};

export const praiseDocumentListTransformer = async (
  praiseDocuments: PraiseDocument[]
): Promise<PraiseDto[]> => {
  const praiseDtoList = await Promise.all(
    praiseDocuments.map((p) => praiseDocumentToDto(p))
  );

  return praiseDtoList;
};

export const praiseDocumentTransformer = async (
  praiseDocument: PraiseDocument
): Promise<PraiseDto> => {
  return await praiseDocumentToDto(praiseDocument);
};
