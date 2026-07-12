import DashboardSkeleton from '@/components/ui/DashboardSkeleton';
import { getServerSession } from '@/lib/getServerSession';

export default async function Loading() {
  const { permissions, isSuperuser } = await getServerSession();
  return <DashboardSkeleton permissions={permissions} isSuperuser={isSuperuser} />;
}
