import { getPreviousPeriod } from "@/utils/periods";
import { AxiosError, AxiosResponse } from "axios";
import React from "react";
import {
  atom,
  atomFamily,
  selector,
  selectorFamily,
  useRecoilCallback,
  useRecoilState,
  useRecoilValue,
} from "recoil";
import {
  ApiAuthGetQuery,
  ApiAuthPatchQuery,
  ApiAuthPostQuery,
  ApiQuery,
  isApiResponseOk,
  PaginatedResponseData,
  useAuthApiQuery,
} from "./api";
import { ActiveUserId } from "./auth";
import {
  avgPraiseScore,
  Praise,
  SinglePraise,
  SinglePraiseExt,
} from "./praise";

export interface Period {
  _id?: string;
  createdAt?: string;
  updatedAt?: string;
  name: string;
  status?: string;
  endDate: string;
}

// The request Id is used to force refresh of AllPeriodsQuery
// AllPeriodsQuery subscribes to the value. Increase to trigger
// refresh.
const PeriodsRequestId = atom({
  key: "PeriodsRequestId",
  default: 0,
});

// A local only copy of all periods. Used to facilitate CRUD
// without having to make full roundtrips to the server
export const AllPeriods = atom<Period[] | undefined>({
  key: "AllPeriods",
  default: undefined,
});

export const AllPeriodsQuery = selector({
  key: "AllPeriodsQuery",
  get: async ({ get }) => {
    get(PeriodsRequestId);
    const periods = get(
      ApiAuthGetQuery({
        endPoint: "/api/periods/all?sortColumn=endDate&sortType=desc",
      })
    );
    return periods;
  },
});

export const SinglePeriod = selectorFamily({
  key: "SinglePeriod",
  get:
    (params: any) =>
    async ({ get }) => {
      const allPeriods = get(AllPeriods);
      if (!allPeriods) return null;
      return allPeriods.find((period) => period._id === params.periodId);
    },
});

export const SinglePeriodByDate = selectorFamily({
  key: "SinglePeriodByDate",
  get:
    (anyDate: string | undefined) =>
    async ({ get }) => {
      const allPeriods = get(AllPeriods);
      if (!allPeriods || !anyDate) return null;
      return allPeriods
        .slice()
        .reverse()
        .find((period) => new Date(period.endDate) > new Date(anyDate));
    },
});

export const useAllPeriodsQuery = () => {
  const allPeriodsQueryResponse = useAuthApiQuery(AllPeriodsQuery);
  const [allPeriods, setAllPeriods] = useRecoilState(AllPeriods);

  // Only set AllPeriods if not previously loaded
  React.useEffect(() => {
    if (
      isApiResponseOk(allPeriodsQueryResponse) &&
      typeof allPeriods === "undefined"
    ) {
      const paginatedResponse =
        allPeriodsQueryResponse.data as PaginatedResponseData;
      const periods = paginatedResponse.docs as Period[];
      if (Array.isArray(periods) && periods.length > 0) {
        setAllPeriods(periods);
      }
    }
  }, [allPeriodsQueryResponse, setAllPeriods, allPeriods]);

  return allPeriodsQueryResponse;
};

// Stores the api response from the latest call to /api/admin/periods/create
export const CreatePeriodApiResponse = atom<
  AxiosResponse<never> | AxiosError<never> | null
>({
  key: "CreatePeriodApiResponse",
  default: null,
});

// Hook that returns a function to use for creating a new period
export const useCreatePeriod = () => {
  const allPeriods: Period[] | undefined = useRecoilValue(AllPeriods);

  const createPeriod = useRecoilCallback(
    ({ snapshot, set }) =>
      async (period: Period) => {
        const response = await ApiQuery(
          snapshot.getPromise(
            ApiAuthPostQuery({
              endPoint: "/api/admin/periods/create",
              data: period,
            })
          )
        );
        //If OK response, add returned period object to local state
        if (isApiResponseOk(response)) {
          const period = response.data as Period;
          if (period) {
            if (typeof allPeriods !== "undefined") {
              set(AllPeriods, [...allPeriods, period]);
            } else {
              set(AllPeriods, [period]);
            }
          }
        }
        set(CreatePeriodApiResponse, response);
        return response;
      }
  );
  return { createPeriod };
};

// Stores the api response from the latest call to /api/admin/periods/update
export const UpdatePeriodApiResponse = atom<
  AxiosResponse<never> | AxiosError<never> | null
>({
  key: "UpdatePeriodApiResponse",
  default: null,
});

export const useUpdatePeriod = () => {
  const allPeriods: Period[] | undefined = useRecoilValue(AllPeriods);
  const updatePeriod = useRecoilCallback(
    ({ snapshot, set }) =>
      async (period: Period) => {
        const response = await ApiQuery(
          snapshot.getPromise(
            ApiAuthPatchQuery({
              endPoint: `/api/admin/periods/${period._id}/update`,
              data: period,
            })
          )
        );

        // If OK response, add returned period object to local state
        if (isApiResponseOk(response)) {
          const period = response.data as Period;
          if (period) {
            if (typeof allPeriods !== "undefined") {
              set(
                AllPeriods,
                allPeriods.map(
                  (oldPeriod) =>
                    oldPeriod._id === period._id ? period : oldPeriod,
                  period
                )
              );
            } else {
              set(AllPeriods, [period]);
            }
          }
        }
        set(UpdatePeriodApiResponse, response);
        return response;
      }
  );
  return { updatePeriod };
};

// Stores the api response from the latest call to /api/admin/periods/close
export const ClosePeriodApiResponse = atom<
  AxiosResponse<never> | AxiosError<never> | null
>({
  key: "ClosePeriodApiResponse",
  default: null,
});

// Hook that returns a function to use for closing a period
export const useClosePeriod = () => {
  const allPeriods: Period[] | undefined = useRecoilValue(AllPeriods);
  const closePeriod = useRecoilCallback(
    ({ snapshot, set }) =>
      async (periodId: string) => {
        const response = await ApiQuery(
          snapshot.getPromise(
            ApiAuthPatchQuery({
              endPoint: `/api/admin/periods/${periodId}/close`,
            })
          )
        );

        if (isApiResponseOk(response)) {
          const period = response.data as Period;
          if (period) {
            if (typeof allPeriods !== "undefined") {
              set(
                AllPeriods,
                allPeriods.map(
                  (oldPeriod) =>
                    oldPeriod._id === period._id ? period : oldPeriod,
                  period
                )
              );
            } else {
              set(AllPeriods, [period]);
            }
          }
        }
        set(UpdatePeriodApiResponse, response);
        return response;
      }
  );
  return { closePeriod };
};

export const VerifyQuantifierPoolSizeQuery = selectorFamily({
  key: "VerifyQuantifierPoolSizeQuery",
  get:
    (params: any) =>
    async ({ get }) => {
      const { periodId, refreshKey } = params;
      const response = get(
        ApiAuthPatchQuery({
          endPoint: `/api/admin/periods/${periodId}/verifyQuantifierPoolSize`,
          refreshKey,
        })
      );
      return response;
    },
});

export interface PoolRequirements {
  quantifierPoolSize: number;
  requiredPoolSize: number;
}

export const useVerifyQuantifierPoolSize = (
  periodId: number,
  refreshKey: string | undefined
): PoolRequirements | undefined => {
  const response = useAuthApiQuery(
    VerifyQuantifierPoolSizeQuery({ periodId, refreshKey })
  );
  const [poolRequirements, setPoolRequirements] = React.useState<
    PoolRequirements | undefined
  >(undefined);

  React.useEffect(() => {
    if (isApiResponseOk(response)) {
      setPoolRequirements(response.data);
    }
  }, [response]);

  return poolRequirements;
};

export const useAssignQuantifiers = () => {
  const allPeriods = useRecoilValue(AllPeriods);

  const saveIndividualPraise = useRecoilCallback(
    ({ set }) =>
      async (praiseList: Praise[]) => {
        for (const praise of praiseList) {
          set(SinglePraise(praise._id), praise);
        }
      }
  );

  const assignQuantifiers = useRecoilCallback(
    ({ snapshot, set }) =>
      async (periodId: string) => {
        const response = await ApiQuery(
          snapshot.getPromise(
            ApiAuthPatchQuery({
              endPoint: `/api/admin/periods/${periodId}/assignQuantifiers`,
            })
          )
        );
        if (isApiResponseOk(response)) {
          const praiseList = response.data as Praise[];
          if (Array.isArray(praiseList) && praiseList.length > 0) {
            saveIndividualPraise(praiseList);
          }
          if (allPeriods) {
            set(
              AllPeriods,
              allPeriods.map((period) => {
                if (period._id === periodId) {
                  const newPeriod = {
                    ...period,
                    status: "QUANTIFY",
                  };
                  return newPeriod;
                }
                return period;
              })
            );
          }
        }
        return response;
      }
  );
  return { assignQuantifiers };
};

// The request Id is used to force refresh of PeriodPraiseQuery
// PeriodPraiseQuery subscribes to the value. Increase to trigger
// refresh.
const PeriodPraiseRequestId = atom({
  key: "PeriodPraiseRequestId",
  default: 0,
});

export const AllPeriodPraiseIdList = atomFamily<string[] | undefined, string>({
  key: "AllPeriodPraiseIdList",
  default: undefined,
});

export const AllPeriodPraiseList = selectorFamily({
  key: "AllPeriodPraiseList",
  get:
    (params: any) =>
    async ({ get }) => {
      const { periodId } = params;
      const praiseIdList = get(AllPeriodPraiseIdList(periodId));
      const allPraiseList: Praise[] = [];
      if (!praiseIdList) return undefined;
      for (const praiseId of praiseIdList) {
        const praise = get(SinglePraiseExt(praiseId));
        if (praise) allPraiseList.push(praise);
      }
      return allPraiseList;
    },
});

export const PeriodPraiseQuery = selectorFamily({
  key: "PeriodPraiseQuery",
  get:
    (params: any) =>
    async ({ get }) => {
      get(PeriodPraiseRequestId);
      const praise = get(
        ApiAuthGetQuery({ endPoint: `/api/periods/${params.periodId}/praise` })
      );
      return praise;
    },
});

export const usePeriodPraiseQuery = (periodId: string) => {
  const periodPraiseQueryResponse = useAuthApiQuery(
    PeriodPraiseQuery({ periodId })
  );
  const periodPraiseIdList = useRecoilValue(AllPeriodPraiseIdList(periodId));

  const savePeriodPraiseIdList = useRecoilCallback(
    ({ snapshot, set }) =>
      async (praiseList: Praise[]) => {
        const allPraiseIdList = await snapshot.getPromise(
          AllPeriodPraiseIdList(periodId)
        );
        const praiseIdList: string[] = [];
        for (const praise of praiseList) {
          praiseIdList.push(praise._id);
        }
        set(
          AllPeriodPraiseIdList(periodId),
          allPraiseIdList ? allPraiseIdList.concat(praiseIdList) : praiseIdList
        );
      }
  );

  const saveIndividualPraise = useRecoilCallback(
    ({ set }) =>
      async (praiseList: Praise[]) => {
        for (const praise of praiseList) {
          set(SinglePraise(praise._id), praise);
        }
      }
  );

  React.useEffect(() => {
    if (
      typeof periodPraiseIdList === "undefined" &&
      isApiResponseOk(periodPraiseQueryResponse)
    ) {
      const praiseList = periodPraiseQueryResponse.data as Praise[];
      if (Array.isArray(praiseList) && praiseList.length > 0) {
        savePeriodPraiseIdList(praiseList);
        saveIndividualPraise(praiseList);
      }
    }
  }, [
    periodPraiseQueryResponse,
    periodPraiseIdList,
    savePeriodPraiseIdList,
    saveIndividualPraise,
  ]);

  return periodPraiseQueryResponse;
};

export const AllPeriodReceiverPraise = selectorFamily({
  key: "AllPeriodReceiverPraise",
  get:
    (params: any) =>
    async ({ get }) => {
      const { periodId, receiverId } = params;
      const praise = get(AllPeriodPraiseList({ periodId }));
      if (!praise) return undefined;
      return praise.filter((item) => item.receiver._id === receiverId);
    },
});

export interface QuantifierData {
  periodId: string;
  userId: string;
  count: number;
  done: number;
}

export const PeriodQuantifiers = selectorFamily({
  key: "PeriodQuantifiers",
  get:
    (params: any) =>
    async ({ get }) => {
      const { periodId } = params;
      const praise = get(AllPeriodPraiseList({ periodId }));
      if (praise) {
        let q: QuantifierData[] = [];

        for (let praiseItem of praise) {
          if (!praiseItem.quantifications) continue;

          for (let quantification of praiseItem.quantifications) {
            const qi = q.findIndex(
              (item) => item.userId === quantification.quantifier
            );

            const done =
              quantification.score ||
              quantification.dismissed === true ||
              quantification.duplicatePraise
                ? 1
                : 0;

            const qd: QuantifierData = {
              periodId: periodId,
              userId: quantification.quantifier,
              count: qi > -1 ? q[qi].count + 1 : 1,
              done: qi > -1 ? q[qi].done + done : done,
            };

            if (qi > -1) {
              q[qi] = qd;
            } else {
              q.push(qd);
            }
          }
        }
        return q;
      }

      return undefined;
    },
});

export interface ReceiverData {
  receiverId: string;
  username: string;
  praiseCount: number;
  praiseScore: number;
}

export const AllPeriodReceivers = selectorFamily({
  key: "AllPeriodReceivers",
  get:
    (params: any) =>
    async ({ get }) => {
      const { periodId } = params;
      const praise = get(AllPeriodPraiseList({ periodId }));
      if (praise) {
        let r: ReceiverData[] = [];

        for (let praiseItem of praise) {
          const ri = r.findIndex(
            (item) => item.username === praiseItem.receiver.username
          );

          const rd: ReceiverData = {
            receiverId: praiseItem.receiver._id!,
            username: praiseItem.receiver.username,
            praiseCount: ri > -1 ? r[ri].praiseCount + 1 : 1,
            praiseScore:
              ri > -1
                ? r[ri].praiseScore + avgPraiseScore(praiseItem, get)
                : avgPraiseScore(praiseItem, get),
          };

          if (ri > -1) {
            r[ri] = rd;
          } else {
            r.push(rd);
          }
        }
        return r;
      }

      return undefined;
    },
});

export const PeriodReceiver = selectorFamily({
  key: "PeriodReceiver",
  get:
    (params: any) =>
    async ({ get }) => {
      const { receiverId, periodId } = params;
      const allPeriodReceivers = get(AllPeriodReceivers({ periodId }));

      if (!allPeriodReceivers) return undefined;

      return allPeriodReceivers.find((rd) => rd.receiverId === receiverId);
    },
});

export const AllActiveQuantifierQuantifications = selector({
  key: "AllActiveQuantifierQuantifications",
  get: async ({ get }) => {
    const periods = get(AllPeriods);
    const userId = get(ActiveUserId);
    const response: QuantifierData[] = [];
    if (!periods) return undefined;
    for (const period of periods) {
      if (period.status === "QUANTIFY") {
        let periodQuantifiers = get(
          PeriodQuantifiers({ periodId: period._id })
        );
        if (!periodQuantifiers) continue;
        for (const qd of periodQuantifiers) {
          if (qd.userId === userId) response.push(qd);
        }
      }
    }
    return response;
  },
});

export const PeriodActiveQuantifierQuantifications = selectorFamily({
  key: "PeriodActiveQuantifierQuantifications",
  get:
    (params: any) =>
    async ({ get }) => {
      const { periodId } = params;
      const period = get(SinglePeriod({ periodId }));
      const userId = get(ActiveUserId);
      if (!period) return undefined;
      if (period.status === "QUANTIFY") {
        let periodQuantifiers = get(
          PeriodQuantifiers({ periodId: period._id })
        );
        if (!periodQuantifiers) return undefined;
        for (const qd of periodQuantifiers) {
          if (qd.userId === userId) return qd;
        }
      }
      return undefined;
    },
});

export interface QuantifierReceiverData {
  periodId: string;
  receiverId: string;
  receiverName: string;
  count: number;
  done: number;
}

export const PeriodActiveQuantifierReceivers = selectorFamily({
  key: "PeriodActiveQuantifierReceivers",
  get:
    (params: any) =>
    async ({ get }) => {
      const { periodId } = params;
      const praiseList = get(AllPeriodPraiseList({ periodId }));
      const userId = get(ActiveUserId);
      if (praiseList) {
        let q: QuantifierReceiverData[] = [];

        for (let praiseItem of praiseList) {
          if (!praiseItem.quantifications || !praiseItem.receiver._id) continue;
          for (let quantification of praiseItem.quantifications) {
            if (quantification.quantifier !== userId) continue;

            const qi = q.findIndex(
              (item) => item.receiverId === praiseItem.receiver._id
            );

            const done =
              quantification.score ||
              quantification.dismissed === true ||
              quantification.duplicatePraise
                ? 1
                : 0;

            const qd: QuantifierReceiverData = {
              periodId: periodId,
              receiverId: praiseItem.receiver._id,
              receiverName: praiseItem.receiver.username,
              count: qi > -1 ? q[qi].count + 1 : 1,
              done: qi > -1 ? q[qi].done + done : done,
            };

            if (qi > -1) {
              q[qi] = qd;
            } else {
              q.push(qd);
            }
          }
        }
        return q;
      }

      return undefined;
    },
});

export const PeriodActiveQuantifierReceiver = selectorFamily({
  key: "PeriodActiveQuantifierReceiver",
  get:
    (params: any) =>
    async ({ get }) => {
      const { periodId, receiverId } = params;
      const qrd = get(PeriodActiveQuantifierReceivers({ periodId }));
      if (!qrd) return undefined;
      return qrd.find((item) => item.receiverId === receiverId);
    },
});

export const PeriodActiveQuantifierReceiverPraise = selectorFamily({
  key: "PeriodActiveQuantifierReceiverPraise",
  get:
    (params: any) =>
    async ({ get }) => {
      const { periodId, receiverId } = params;
      const userId = get(ActiveUserId);
      const praiseList = get(AllPeriodPraiseList({ periodId }));
      if (!praiseList) return undefined;
      return praiseList.filter(
        (praise) =>
          praise.quantifications!.findIndex(
            (quant) => quant.quantifier === userId
          ) >= 0 && praise.receiver._id! === receiverId
      );
    },
});

export const useExportPraise = () => {
  const allPeriods: Period[] | undefined = useRecoilValue(AllPeriods);

  const exportPraise = useRecoilCallback(
    ({ snapshot, set }) =>
      async (period: Period) => {
        if (!period || !allPeriods) return null;
        const periodStartDate = getPreviousPeriod(allPeriods, period);

        const response = await ApiQuery(
          snapshot.getPromise(
            ApiAuthGetQuery({
              endPoint: `/api/praise/export/?periodStart=${periodStartDate}&periodEnd=${period.endDate}`,
              config: { responseType: "blob" },
            })
          )
        );

        // If OK response, add returned period object to local state
        if (isApiResponseOk(response)) {
          const href = window.URL.createObjectURL(response.data);
          window.location.href = href;
          return href;
        }
      }
  );
  return { exportPraise };
};
