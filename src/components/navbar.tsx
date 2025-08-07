import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Filter, Columns } from "lucide-react";
import { statuses, statusMap, statusReverseMap, columnHeaderNames } from "@/lib/utils";

export function Navbar({ table }) {
  const statusFilterValue = table.getColumn("status")?.getFilterValue();
  const statusValue = statusFilterValue !== undefined ? statusReverseMap[statusFilterValue] : "All";

  return (
    <nav className="flex items-center justify-between p-4 bg-background border-b">
      <h1 className="text-xl font-bold">Transmission</h1>
      <div className="flex items-center space-x-4">
        <Input
          placeholder="Filter by name..."
          value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("name")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              Status: {statusValue}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={statusValue}
              onValueChange={(value) => {
                table.getColumn("status")?.setFilterValue(statusMap[value]);
              }}
            >
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
            <Button variant="outline">
              <Columns className="mr-2 h-4 w-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => {
                const key = column.accessorKey || column.id;
                const headerText = columnHeaderNames[key] || key;
                return (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
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