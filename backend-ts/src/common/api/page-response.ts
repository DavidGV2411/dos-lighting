export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};

export const toPageResponse = <T>(
  content: T[],
  page: number,
  size: number,
  totalElements: number
): PageResponse<T> => {
  const totalPages = totalElements === 0 ? 0 : Math.ceil(totalElements / size);
  return {
    content,
    page,
    size,
    totalElements,
    totalPages,
    first: page === 0,
    last: totalPages === 0 ? true : page >= totalPages - 1
  };
};

