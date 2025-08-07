import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Filter,
  Columns,
  Plus,
  Play,
  Pause,
  Trash2,
  XCircle
} from "lucide-react";
import {
  statuses,
  statusMap,
  statusReverseMap,
  columnHeaderNames
} from "@/lib/utils";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent
} from "@/components/ui/tooltip";

export function Navbar({
  table,
  onAddTorrentClick,
  onStartSelected,
  onStopSelected,
  onRemoveSelected,
  selectedCount
}) {
  const statusFilterValue = table.getColumn("status")?.getFilterValue();
  const statusValue =
    statusFilterValue !== undefined
      ? statusReverseMap[statusFilterValue]
      : "All";

  return (
    <nav className='flex items-center justify-between p-4 bg-background border-b'>
      <div className='flex items-center space-x-2'>
        <h1 className='text-xl font-bold'>Transmission</h1>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant='default' onClick={onAddTorrentClick}>
                <Plus className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side='bottom'
              align='center'
              className='bg-popover text-popover-foreground px-2 py-1 rounded shadow-md text-xs'>
              Add Torrent
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='outline'
                onClick={onStartSelected}
                disabled={selectedCount === 0}>
                <Play className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side='bottom'
              align='center'
              className='bg-popover text-popover-foreground px-2 py-1 rounded shadow-md text-xs'>
              Start Selected
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='outline'
                onClick={onStopSelected}
                disabled={selectedCount === 0}>
                <Pause className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side='bottom'
              align='center'
              className='bg-popover text-popover-foreground px-2 py-1 rounded shadow-md text-xs'>
              Stop Selected
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='destructive'
                onClick={() => onRemoveSelected(false)}
                disabled={selectedCount === 0}>
                <Trash2 className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side='bottom'
              align='center'
              className='bg-popover text-popover-foreground px-2 py-1 rounded shadow-md text-xs'>
              Remove Selected
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='destructive'
                onClick={() => onRemoveSelected(true)}
                disabled={selectedCount === 0}>
                <XCircle className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side='bottom'
              align='center'
              className='bg-popover text-popover-foreground px-2 py-1 rounded shadow-md text-xs'>
              Delete Selected
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className='flex items-center space-x-4'>
        <Input
          placeholder='Filter by name...'
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className='max-w-sm'
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline'>
              <Filter className='mr-2 h-4 w-4' />
              Status: {statusValue}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuRadioGroup
              value={statusValue}
              onValueChange={(value) => {
                table.getColumn("status")?.setFilterValue(statusMap[value]);
              }}>
              {statuses.map((status) => (
                <DropdownMenuRadioItem key={status} value={status}>
                  {status}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant='outline'>
              <Columns className='mr-2 h-4 w-4' />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                const key = column.accessorKey || column.id;
                const headerText = columnHeaderNames[key] || key;
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className='capitalize'
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }>
                    {headerText}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle />
      </div>
    </nav>
  );
}
