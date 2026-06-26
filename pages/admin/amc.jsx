import { getUserFromRequest } from "@/lib/auth";
import AdminAmcTable from "@/components/admin/amc/AdminAmcTable";

export async function getServerSideProps(context) {
  const user = await getUserFromRequest(context.req);

  if (!user) {
    return {
      redirect: {
        destination: "/Adminlogin",
        permanent: false,
      },
    };
  }

  if (user.role === "customer") {
    return {
      redirect: {
        destination: "/Customerdashboard",
        permanent: false,
      },
    };
  }

  if (user.role === "worker") {
    return {
      redirect: {
        destination: "/Techniciandashboard",
        permanent: false,
      },
    };
  }

  if (user.role === "storekeeper") {
    return {
      redirect: {
        destination: "/Storedashboard",
        permanent: false,
      },
    };
  }

  return {
    props: {
      user,
    },
  };
}

export default function AdminAmcPage({ user }) {
  return <AdminAmcTable user={user} />;
}
