import LoaderSpinner from '@/components/LoaderSpinner';
import { ActiveUserId } from '@/model/auth';
import { AllPraiseQueryPagination, useAllPraiseQuery } from '@/model/praise';
import { SingleUser } from '@/model/users';
import { UserDto } from 'api/dist/user/types';
import React, { useCallback } from 'react';
import { BottomScrollListener } from 'react-bottom-scroll-listener';
import { useRecoilState, useRecoilValue } from 'recoil';
import { MY_PRAISE_LIST_KEY } from './MyPraiseTable';

//TODO add support for more than one user account connected to one user
const getReceiverId = (user: UserDto | undefined): string | undefined => {
  const accounts = user?.accounts;
  return Array.isArray(accounts) && accounts.length > 0
    ? accounts[0]._id
    : undefined;
};

const MyPraisePageLoader = (): JSX.Element | null => {
  const userId = useRecoilValue(ActiveUserId);
  const user = useRecoilValue(SingleUser({ userId }));

  const receiverId = getReceiverId(user);

  const MyPraisePageLoaderInner = (): JSX.Element => {
    const [praisePagination, setPraisePagination] = useRecoilState(
      AllPraiseQueryPagination(MY_PRAISE_LIST_KEY)
    );

    const queryResponse = useAllPraiseQuery(
      {
        page: praisePagination.currentPage,
        limit: 20,
        sortColumn: 'createdAt',
        sortType: 'desc',
        receiver: receiverId,
      },
      MY_PRAISE_LIST_KEY
    );
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
      setLoading(false);
    }, [queryResponse]);

    const handleContainerOnBottom = useCallback(() => {
      if (
        loading ||
        praisePagination.currentPage >= praisePagination.totalPages
      )
        return;
      setLoading(true);

      setTimeout(() => {
        setPraisePagination({
          ...praisePagination,
          currentPage: praisePagination.currentPage + 1,
        });
      }, 1000);
    }, [praisePagination, loading, setPraisePagination]);

    if (loading) return <LoaderSpinner />;

    /* This will trigger handleOnDocumentBottom when the body of the page hits the bottom */
    return (
      <BottomScrollListener
        onBottom={handleContainerOnBottom}
        triggerOnNoScroll
      />
    );
  };

  if (!receiverId) return null;
  return <MyPraisePageLoaderInner />;
};

export default MyPraisePageLoader;