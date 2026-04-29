import React from 'react';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (items: number) => void;
  showItemsPerPage?: boolean;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  showItemsPerPage = true,
  className,
}) => {
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    
    // 总是显示第一页
    pages.push(1);
    
    // 当前页附近
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    
    // 总是显示最后一页
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    // 去重并排序
    return [...new Set(pages)].sort((a, b) => a - b);
  };

  const pageNumbers = getPageNumbers();
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={clsx('flex items-center justify-between py-3', className)}>
      <div className="flex-1 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-700">
            显示 <span className="font-medium">{startItem}</span> 到{' '}
            <span className="font-medium">{endItem}</span> 条，共{' '}
            <span className="font-medium">{totalItems}</span> 条结果
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {showItemsPerPage && onItemsPerPageChange && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">每页显示</span>
              <select
                value={itemsPerPage}
                onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          )}

          <nav className="flex items-center space-x-2">
            <button
              onClick={handlePrevious}
              disabled={currentPage === 1}
              className={clsx(
                'relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium',
                currentPage === 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <span className="sr-only">上一页</span>
              <ChevronLeft className="h-5 w-5" />
            </button>

            {pageNumbers.map((pageNumber, index, array) => {
              // 检查是否需要显示省略号
              const showEllipsis = index > 0 && pageNumber - array[index - 1] > 1;
              
              return (
                <React.Fragment key={pageNumber}>
                  {showEllipsis && (
                    <span className="px-2 py-2 text-gray-700">...</span>
                  )}
                  
                  <button
                    onClick={() => onPageChange(pageNumber)}
                    className={clsx(
                      'relative inline-flex items-center px-4 py-2 text-sm font-medium rounded-md',
                      currentPage === pageNumber
                        ? 'z-10 bg-blue-600 text-white focus:z-20'
                        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    {pageNumber}
                  </button>
                </React.Fragment>
              );
            })}

            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className={clsx(
                'relative inline-flex items-center px-2 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium',
                currentPage === totalPages
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <span className="sr-only">下一页</span>
              <ChevronRight className="h-5 w-5" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Pagination;