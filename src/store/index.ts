import axios from "axios";
import { atom, selectorFamily } from "recoil";

const apiGet = async (endPoint: string) => {
  if (!process.env.REACT_APP_BACKEND_URL) {
    console.log("BACKEND URL NOT SET");
  }

  return axios.get(`${process.env.REACT_APP_BACKEND_URL}${endPoint}`);
};

const apiPost = async (endPoint: string, data: any) => {
  if (!process.env.REACT_APP_BACKEND_URL) {
    console.log("BACKEND URL NOT SET");
  }

  return axios.post(`${process.env.REACT_APP_BACKEND_URL}${endPoint}`, data);
};

export const LoginNonceState = atom({
  key: "LoginNonceState",
  default: undefined,
});

export const NonceQuery = selectorFamily({
  key: "NonceQuery",
  get:
    (params: any) =>
    async ({ get }) => {
      const response = (await apiGet(
        `/api/auth/nonce?publicKey=${params.ethAccount}`
      )) as any;

      // ADD ERROR HANDLING
      // ADD TYPE CHECKING
      return response!.data!.nonce;
    },
});

export const AuthQuery = selectorFamily({
  key: "AuthQuery",
  get:
    (params: any) =>
    async ({ get }) => {
      if (!params.ethAccount || !params.message || !params.signature)
        return undefined;

      const data = {
        publicKey: params.ethAccount,
        message: params.message,
        signature: params.signature,
      };
      const response = (await apiPost(`/api/auth`, data)) as any;

      // ADD ERROR HANDLING
      // ADD TYPE CHECKING
      return response!.data!;
    },
});
